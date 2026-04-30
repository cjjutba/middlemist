# PDF generation

Middlemist generates PDFs for proposals and invoices. Two templates exist: `lib/pdf/proposal.tsx` and `lib/pdf/invoice.tsx`, both built with `@react-pdf/renderer`. PDFs are rendered on demand in route handlers; there is no precomputation in v1. The decision to use react-pdf over Puppeteer is captured in ADR 0005.

## Tool choice

`@react-pdf/renderer` is a pure JavaScript engine that turns React components into PDFs. It does not embed Chromium. The advantage on Vercel is significant: cold-start time is measured in tens of milliseconds (the renderer is a small library), versus seconds for headless Chromium. The disadvantage is real: react-pdf does not support the full CSS grammar of the web. Layout uses a flex-like model with limitations around text wrapping, no support for inline-block, no shared component reuse with the rest of the app's UI.

For two templates rendered occasionally (when a freelancer downloads or a client clicks "download PDF" in a proposal or invoice), the cost is acceptable. ADR 0005 covers the alternative analysis.

## Templates

```
src/lib/pdf/
  proposal.tsx     // <ProposalPdf proposal={...} freelancer={...} client={...} />
  invoice.tsx      // <InvoicePdf invoice={...} freelancer={...} client={...} />
  shared/
    Page.tsx       // shared page wrapper (margins, footer)
    Header.tsx     // freelancer logo + business info
    AddressBlock.tsx
    typography.ts  // styles for headings, body, mono
    colors.ts      // matches app design tokens (primary #111111, neutrals)
```

Both templates render synchronously from a fully-loaded model: the proposal or invoice with its lines/blocks, the freelancer (for branding), and the client (for address). Templates do not query the database; the route handler does that and passes hydrated objects.

## Generation flow

### Authenticated freelancer view

Route: `GET /api/pdf/proposal/[id]` and `GET /api/pdf/invoice/[id]`.

```typescript
// src/app/api/pdf/proposal/[id]/route.ts
import { auth } from "@/lib/auth/config";
import { proposalsRepo } from "@/lib/repositories/proposals.repo";
import { renderToStream } from "@react-pdf/renderer";
import { ProposalPdf } from "@/lib/pdf/proposal";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const proposal = await proposalsRepo.findByIdForPdf(session.user.id, id);
  if (!proposal) return new Response("Not found", { status: 404 });

  const stream = await renderToStream(
    <ProposalPdf
      proposal={proposal}
      freelancer={proposal.user}
      client={proposal.client}
    />
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug(proposal.title)}.pdf"`,
    },
  });
}
```

The repo function `findByIdForPdf` returns the proposal with `user` and `client` joined; it is a separate function from `findById` to keep the read shape explicit. Same pattern for invoices.

### Public client view

Route: `GET /api/pdf/public/proposal/[token]` and `GET /api/pdf/public/invoice/[token]`.

```typescript
export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const proposal = await proposalsRepo.findByPublicTokenForPdf(token);
  if (!proposal) return new Response("Not found", { status: 404 });
  // (rate limit applied in middleware on /api/pdf/public/* paths)

  const stream = await renderToStream(
    <ProposalPdf
      proposal={proposal}
      freelancer={proposal.user}
      client={proposal.client}
    />
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: { "Content-Type": "application/pdf" },
  });
}
```

The public path does not require a session; the token is the access proof. Public PDF routes are rate-limited at the same coarse limit as the document HTML routes (30 req/min per IP per token via Upstash).

## On-demand vs cached

v1 generates PDFs on every request. There is no caching layer. The cost is bounded:

- A typical proposal renders in 200-400ms.
- A typical invoice renders in 100-200ms.
- Volume is low: a proposal might be downloaded a few times, an invoice might be downloaded once or twice per send.

If render time becomes a problem, the v2 plan is to cache to UploadThing keyed by content hash: hash the input model JSON, look up by hash, generate and store if missing, return the URL. The repo function and the route handler are the only places that change. No schema changes are needed.

## Branding

Every PDF includes:

- **Header**: freelancer's logo (from `User.logoUrl`), business name (`User.businessName`), and address (`User.businessAddress`).
- **Footer**: page number, business name, optional tax ID (`User.businessTaxId`).
- **Ink color**: `#111111` for headings, dividers, and the signature mark. The web brand is monochrome at the action layer; PDFs follow the same rule and use no color beyond ink and neutrals.
- **Typography**: Inter Display (weight 600, negative letter-spacing) for the document title and section headings; Inter for body; JetBrains Mono for line item numbers and invoice numbers. Fonts are bundled with `Font.register` at module load.
- **Signature** (proposals only): if the freelancer has uploaded `User.signatureUrl`, it renders above their typed name on the signature block. The client's typed name renders next to it after acceptance, with the timestamp and IP from `Proposal.acceptance*` fields.

## Accessibility

react-pdf has limits. PDFs it generates are not WCAG-conformant out of the box: they do not include structure tags, the reading order can be brittle for multi-column layouts, and links use `<Link>` which does not always render as accessible PDF annotations. v1 accepts these limitations.

The templates avoid the worst of it by:

- Using single-column layouts.
- Setting `Text` styles with explicit `fontSize` and `lineHeight` for predictable extraction.
- Including a plain-text alternative path: clients can always view the proposal or invoice as HTML on `/p/[token]` or `/i/[token]`, which is fully accessible.

A v2 candidate is to use react-pdf's experimental tagged-PDF support if it stabilizes.

## Testing

Each template has an integration test that generates a sample PDF and asserts:

- The result is a non-empty Buffer.
- The first four bytes are `%PDF`.
- The buffer size is within a sane range (e.g., 5KB to 5MB) so a regression that produces empty or runaway output is caught.

```typescript
// src/lib/pdf/__tests__/proposal.test.ts
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { ProposalPdf } from "../proposal";
import { sampleProposal, sampleFreelancer, sampleClient } from "./fixtures";

describe("ProposalPdf", () => {
  it("renders a non-empty PDF", async () => {
    const buffer = await renderToBuffer(
      <ProposalPdf
        proposal={sampleProposal}
        freelancer={sampleFreelancer}
        client={sampleClient}
      />
    );
    expect(buffer.byteLength).toBeGreaterThan(5_000);
    expect(buffer.byteLength).toBeLessThan(5_000_000);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
```

Visual regressions are caught by manual review during development. The dev workflow includes a route `/dev/pdf-preview` (in `(dev)` segment, gated to localhost) that renders templates in the browser using react-pdf's `PDFViewer` component for fast iteration.

## Limitations to know about

- **No rich-text wrapping inside arbitrary widths.** A long Tiptap-rendered paragraph inside a fixed-width block will wrap, but the wrapping algorithm differs from a browser. Inspect output before assuming.
- **No CSS grid.** Use react-pdf's `View` with `flexDirection`.
- **No table HTML element.** Tables are flex rows. The invoice line item table is built this way.
- **Limited inline element support.** Mixing bold, italic, and links inside a single text node requires the `Text` component's children pattern, not HTML inlines.
- **Page breaks** are mostly automatic but can produce orphaned single lines; use `wrap={false}` on small atomic blocks to prevent splits.

When a layout choice runs into one of these limitations, change the design to fit the engine; do not spend a day fighting react-pdf.
