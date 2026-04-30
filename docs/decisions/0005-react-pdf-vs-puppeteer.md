# 0005: react-pdf vs Puppeteer

**Date:** 2026-04-29
**Status:** Accepted

## Context

Middlemist generates PDFs for two document types: proposals and invoices. Both are sent to clients as on-demand PDF downloads from the public document routes (`/api/pdf/public/proposal/[token]` and the invoice equivalent) and from the freelancer's authenticated download buttons.

Two architectural approaches dominate this space:

- **`@react-pdf/renderer`**, a pure-JS PDF engine that turns React-shaped components into PDF documents using a flex-like layout model.
- **Headless Chromium via Puppeteer (or Playwright)**, which renders a full HTML page to PDF using the browser's print engine, allowing reuse of the existing web UI's CSS.

The hosting context (Vercel serverless functions) is again decisive. Headless Chromium has notoriously slow cold starts on Vercel: pulling in the binary, instantiating the browser, and rendering a single PDF can run several seconds end-to-end on a cold function. PDF generation in Middlemist is on-demand and expected to feel instant for the user (under one second).

## Decision

Use `@react-pdf/renderer`. Define two templates, `src/lib/pdf/proposal.tsx` and `src/lib/pdf/invoice.tsx`, plus shared primitives in `src/lib/pdf/shared/`. Render on demand in route handlers (see `pdf-generation.md`). Do not cache; re-render on every request.

Accept the layout limitations: no CSS grid, limited rich-text wrapping, no shared component reuse with the rest of the app's UI.

## Consequences

**Positive**

- Pure JavaScript. No Chromium binary, no `chrome-aws-lambda` glue, no binary-size pressure on the Vercel function bundle.
- Fast cold starts. The renderer is a small library (a few hundred KB); cold-start adds tens of milliseconds, not seconds.
- JSX authoring. Templates are ordinary React components with their own typed props and unit-testable structure.
- Predictable output. The layout model is explicit; the same input produces the same PDF byte-for-byte (modulo build-time font embedding), which is useful for tests.

**Negative**

- Limited CSS. No flexbox parity with the web (the engine's flex is a subset). No CSS grid. No inline-block. Layouts must be authored to fit the engine, not adapted from existing web styles.
- No shared component reuse. The proposal page on the web (`/p/[token]`) and the proposal PDF cannot share components. The two are maintained in parallel; visual drift is a real risk and is mitigated by treating the PDF as a separate canonical surface.
- Text wrapping has rough edges. Long inline runs with mixed weights or fonts can produce surprising line breaks. The mitigation is to keep the text simple inside PDF templates: paragraph by paragraph, single weight unless explicitly demarcated.
- Accessibility is limited. `react-pdf` does not produce tagged PDFs by default; structure information for screen readers is absent. The mitigation is that the public HTML routes are fully accessible; clients who need accessibility can use the HTML view.

## Alternatives Considered

**Puppeteer (or Playwright) headless Chromium.** Use the existing web UI's CSS by rendering the HTML page to PDF. Rejected for serverless cold-start reasons. On a long-lived server, this approach is excellent; on Vercel functions, the cold-start cost ruins the user experience for "click download, wait three seconds."

**`pdf-lib` (low-level).** A primitive-level PDF library where you compose pages by drawing text and rectangles. Rejected because the level of abstraction is too low; building the proposal layout in primitives would take many days and many bugs.

**Server-side LaTeX.** Highest typographic quality. Rejected because LaTeX as a render dependency on Vercel would mean shipping a TeX distribution in the bundle; the binary cost is enormous and the build complexity is not justified.

**Browser-side print.** Have the client press Cmd+P on the HTML view. Rejected because the freelancer's "send invoice as PDF" use case requires a server-generated PDF for email attachment, and the client's "download PDF" button on the public view is expected to produce a PDF, not a print preview.

**Hosted PDF API (DocRaptor, PDFShift, etc.).** External rendering services that take a URL and return a PDF. Rejected because adding another vendor with another billing relationship and another point of failure is not worth the marginal layout fidelity for two templates.
