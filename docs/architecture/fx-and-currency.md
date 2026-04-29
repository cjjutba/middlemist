# FX and currency

Middlemist supports six currencies in v1 and shows freelancers their cross-currency totals in their preferred currency. Money is always stored as `Decimal` with an explicit `currency` ISO code; nothing in the schema stores money as a number without currency context. FX rates refresh daily from exchangerate.host.

## Storage rule

Every monetary column is `Decimal` (precision 12, scale 2 for amounts; precision 18, scale 8 for FX rates). Every row that holds money also has a `currency` column or inherits one from its parent. There is no "default currency" applied at read time; the currency travels with the value.

Examples:

- `Project.budgetAmount` (Decimal) plus `Project.currency` (Currency enum).
- `Invoice.subtotal`, `Invoice.taxAmount`, `Invoice.total` (Decimal) plus `Invoice.currency`. Line items inherit the invoice's currency.
- `Proposal.totalAmount` (Decimal) plus `Proposal.currency`.
- `SavedPricingItem.rate` (Decimal) plus `SavedPricingItem.currency`. The user's saved pricing items can be in different currencies; the proposal builder converts on insertion if needed.

A `Money` helper type is defined and used at the application boundary:

```typescript
// src/lib/money/types.ts
import { Decimal } from "@prisma/client/runtime/library";
import { Currency } from "@prisma/client";

export type Money = { amount: Decimal; currency: Currency };

export const money = (amount: number | string | Decimal, currency: Currency): Money => ({
  amount: new Decimal(amount),
  currency,
});
```

JavaScript `number` is never used for amounts inside business logic. Only at display time is the `Decimal` converted to a number for `Intl.NumberFormat`.

## Supported currencies (v1)

```
PHP — Philippine peso (the freelancer's base; CJ is in PH)
USD — US dollar (most common client currency)
EUR — euro
GBP — British pound
AUD — Australian dollar
CAD — Canadian dollar
```

The list is small on purpose. Adding a currency means adding it to the `Currency` enum, the FX refresh job, the locale formatting maps, and the UI selector. Each is small but the surface multiplies.

A v2 candidate is to expand to the long tail of ISO 4217 codes the freelancer might encounter. Priority for that expansion will come from real client data.

## FX provider

`exchangerate.host` is the free FX API in use. Endpoint:

```
GET https://api.exchangerate.host/latest?base=USD&symbols=PHP,EUR,GBP,AUD,CAD
```

Free tier: no API key required for basic latest-rate queries. Rate limits are generous for daily fetching. If exchangerate.host's reliability deteriorates, alternatives include `openexchangerates.org` (paid for some endpoints), `frankfurter.app` (free, ECB-based), and `currencylayer.com`. The job is one file; swapping providers is contained.

## Refresh schedule

The Inngest cron `fx.refresh` runs daily at 06:00 UTC. The handler:

1. For each base currency in the supported set, fetch rates against all other supported quotes.
2. Upsert each `(base, quote)` pair into `FxRate` with the new rate and `fetchedAt = now`.
3. Log the count of upserts to the audit log under `fx.refreshed` (action stored as a special system entry with `userId = null`).

```typescript
// src/lib/inngest/functions/fx-refresh.ts
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { Currency } from "@prisma/client";

const SUPPORTED: Currency[] = ["PHP", "USD", "EUR", "GBP", "AUD", "CAD"];

export const fxRefresh = inngest.createFunction(
  { id: "fx-refresh" },
  { cron: "0 6 * * *" },
  async ({ step }) => {
    for (const base of SUPPORTED) {
      const quotes = SUPPORTED.filter((c) => c !== base).join(",");
      const json = (await step.run(`fetch-${base}`, async () => {
        const res = await fetch(
          `https://api.exchangerate.host/latest?base=${base}&symbols=${quotes}`
        );
        if (!res.ok) throw new Error(`exchangerate.host returned ${res.status}`);
        return res.json();
      })) as { rates: Record<string, number> };

      for (const [quote, rate] of Object.entries(json.rates)) {
        await step.run(`upsert-${base}-${quote}`, async () => {
          await prisma.fxRate.upsert({
            where: { base_quote: { base, quote: quote as Currency } },
            create: { base, quote: quote as Currency, rate, fetchedAt: new Date() },
            update: { rate, fetchedAt: new Date() },
          });
        });
      }
    }
    return { ok: true };
  }
);
```

A single base currency could mathematically derive crosses, but the upstream API returns crosses already and the storage cost is trivial. Storing all pairs simplifies the conversion service and avoids a runtime cross-rate calculation.

## Storage shape

```prisma
model FxRate {
  id        String   @id @default(cuid())
  base      Currency
  quote     Currency
  rate      Decimal  @db.Decimal(18, 8)
  fetchedAt DateTime

  @@unique([base, quote])
  @@index([fetchedAt])
}
```

`Decimal(18, 8)` is enough precision to handle small-value pairs (e.g., USD/JPY-style rates with many decimals; not in v1, but the schema is forward-compatible).

## Conversion service

```typescript
// src/lib/services/fx.service.ts
import { Decimal } from "@prisma/client/runtime/library";
import { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Money } from "@/lib/money/types";

export const fxService = {
  async convert(amount: Money, to: Currency): Promise<Money> {
    if (amount.currency === to) return amount;
    const rate = await prisma.fxRate.findUnique({
      where: { base_quote: { base: amount.currency, quote: to } },
    });
    if (!rate) {
      throw new Error(
        `No FX rate available for ${amount.currency} -> ${to}; refresh may be lagging`
      );
    }
    const converted = amount.amount.mul(rate.rate);
    return { amount: roundForCurrency(converted, to), currency: to };
  },

  async isStale(): Promise<boolean> {
    const latest = await prisma.fxRate.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    });
    if (!latest) return true;
    return Date.now() - latest.fetchedAt.getTime() > 48 * 60 * 60 * 1000;
  },
};

function roundForCurrency(value: Decimal, currency: Currency): Decimal {
  const decimals = decimalsFor(currency);
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_EVEN);
}

function decimalsFor(currency: Currency): number {
  // Banker's rounding to standard decimal places for each currency.
  // All v1 supported currencies use 2 decimals.
  switch (currency) {
    case "PHP":
    case "USD":
    case "EUR":
    case "GBP":
    case "AUD":
    case "CAD":
      return 2;
  }
}
```

## Display rules

- **Invoices and proposals display in their own currency.** A USD invoice always renders as `$X,XXX.00 USD`; it is not converted on the client view.
- **Dashboard "outstanding" total displays in the freelancer's `defaultCurrency`.** The dashboard sums outstanding invoices in their original currencies, converts each to `defaultCurrency`, and renders the total. Each line in the dashboard list shows its own currency; the rolled-up total uses the user's preferred one.
- **Time-period totals (this month, this quarter)** follow the same pattern: per-row in source currency, total in default currency.

The convention: per-row money is shown as it was billed; aggregates are shown in the user's preferred currency.

## Rounding

Banker's rounding (`ROUND_HALF_EVEN`) at the standard decimal places for each currency. All v1 currencies use 2 decimal places, so rounding is straightforward: a value of `12.345` rounds to `12.34` (round half to even) and a value of `12.355` rounds to `12.36`.

Banker's rounding is preferred over round-half-up because the cumulative bias of round-half-up across many small conversions can produce noticeable drift.

The rounding happens at the boundary of conversion and at the boundary of presentation. Internally, intermediate values stay at full precision.

## Stale rates

If `fxService.isStale()` returns true (latest fetch is more than 48 hours old), the dashboard surfaces a warning banner: "FX rates last updated {timestamp}. Conversions may be inaccurate." The banner does not block the UI; the user can still see converted totals, with the caveat displayed.

48 hours is conservative. The cron runs daily; under normal conditions the latest fetch is between 0 and 24 hours old. The stale threshold is set high enough that a single failed cron run does not trigger the banner, but a multi-day outage does.

## Adding a currency

1. Add the new value to the `Currency` enum in Prisma. Migrate.
2. Add the value to the `SUPPORTED` array in `fx-refresh.ts`.
3. Add the value to `decimalsFor` if it differs from the default 2 (e.g., JPY uses 0).
4. Add the locale and symbol to the formatting helpers in `src/lib/money/format.ts`.
5. Add the value to UI selectors (currency dropdown on project, invoice, etc.).
6. Trigger an `fx.refresh` run to seed the new rates.
