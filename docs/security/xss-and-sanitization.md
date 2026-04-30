# XSS and sanitization

The product surfaces user-supplied rich text in three places: proposal body blocks, update content, and customizable email signature/intro fields. Each of those is rendered as HTML at some point, and each is the kind of place an XSS payload could land if the pipeline is not careful. This document covers the three risk surfaces, the three layers of defense, the explicit allowlist for rich-text rendering, and the `dangerouslySetInnerHTML` policy.

## Risk surfaces

**Rich text in updates and proposal body blocks (Tiptap).** Both surfaces let the freelancer compose formatted content with Tiptap v2. The output is JSON. The HTML rendering happens server-side in two places: the in-app view (`/updates/[id]`, `/proposals/[id]`) and the public view (`/p/[token]`). If the JSON-to-HTML rendering preserves an unauthorized tag, attribute, or scheme, that tag reaches the browser and runs.

**Client-supplied content on `/p/[token]` accept.** The proposal accept form takes `signatureName` (a typed signature) and renders it back on the confirmation page and in the audit log. Length is bounded by the schema; rendering must escape the value.

**Email templates that interpolate user data.** React Email renders to HTML and the freelancer can supply a markdown signature, custom subject and body for a few transactional emails, and per-template overrides. The interpolation step ("expand `{client_name}` against the email context") must escape values that originate from user input.

**Client portal display of all of the above.** The portal renders the same updates, proposals, and invoices that the freelancer creates. A payload that survives one render path will be reflected in the portal too. The defense layers run identically in both places.

## React's default escaping is the baseline

React escapes interpolated strings in JSX by default. `<p>{client.name}</p>` is safe regardless of what `client.name` contains; React HTML-encodes the value before inserting it into the DOM. That gets the application 90% of the way there. The remaining 10% is everywhere a string is rendered as HTML rather than as text — the rich-text renderers, `dangerouslySetInnerHTML`, the rendered HTML of an email template, and any place a `href` or `src` attribute is set from user input.

The application code uses React's escaping everywhere it can. The exceptions are documented below and reviewed individually.

## `dangerouslySetInnerHTML` policy

ESLint forbids `dangerouslySetInnerHTML` outside two whitelisted files. CI fails on violation. The two files:

- `src/components/rich-text/proposal-block-renderer.tsx`
- `src/components/rich-text/update-renderer.tsx`

Both render Tiptap output that has been sanitized server-side immediately upstream. New uses require an ADR and an extension to the ESLint allowlist.

The ESLint rule:

```javascript
// eslint.config.js (excerpt)
export default [
  {
    rules: {
      "react/no-danger": ["error"],
    },
  },
  {
    files: [
      "src/components/rich-text/proposal-block-renderer.tsx",
      "src/components/rich-text/update-renderer.tsx",
    ],
    rules: {
      "react/no-danger": "off",
    },
  },
];
```

A new caller of `dangerouslySetInnerHTML` (for example, a third-party embed widget) writes an ADR documenting why the alternative (server-side render to React elements, or iframe sandboxing) was rejected.

## Layer 1: Tiptap output as JSON

Tiptap stores documents as JSON, not as HTML, in the database. The shape:

```json
{
  "type": "doc",
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "Hello" }] }
  ]
}
```

Storing JSON means the database is unaware of HTML at all. There is no place to inject a `<script>` tag because the storage shape does not represent script tags; the schema validators reject any node type not in the allowlist.

The schema validator runs at write time:

```typescript
// src/lib/rich-text/validate.ts
import { z } from "zod";

const allowedNodeTypes = [
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
  "text",
] as const;

const allowedMarkTypes = ["bold", "italic", "code", "link"] as const;

export const richTextNodeSchema: z.ZodType = z.lazy(() =>
  z.object({
    type: z.enum(allowedNodeTypes),
    content: z.array(richTextNodeSchema).optional(),
    text: z.string().max(50000).optional(),
    attrs: z.record(z.unknown()).optional(),
    marks: z
      .array(
        z.object({
          type: z.enum(allowedMarkTypes),
          attrs: z.record(z.unknown()).optional(),
        })
      )
      .optional(),
  })
);

export const richTextDocSchema = richTextNodeSchema.refine(
  (n) => n.type === "doc",
  "Root node must be a doc"
);
```

A node of `type: "html"` or `type: "embed"` is rejected by the schema before the row is written. Adding a node type means updating the allowlist and the renderer in lockstep.

## Layer 2: server-side HTML rendering with allowlist

Rendering Tiptap JSON to HTML happens on the server through the official Tiptap HTML renderer (`@tiptap/html`). The renderer takes the JSON, walks the tree, and produces HTML according to the same set of node and mark types that wrote it. A node type the renderer does not recognize is dropped silently.

Because the renderer is configured with the same allowlist as the schema, the produced HTML cannot contain anything outside the allowlist. There is no `<script>`, no `<iframe>`, no `<style>`, no event-handler attributes (`onclick`, `onerror`, etc.).

```typescript
// src/lib/rich-text/render.ts
import { generateHTML } from "@tiptap/html";
import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { Heading } from "@tiptap/extension-heading";
import { BulletList } from "@tiptap/extension-bullet-list";
import { OrderedList } from "@tiptap/extension-ordered-list";
import { ListItem } from "@tiptap/extension-list-item";
import { Blockquote } from "@tiptap/extension-blockquote";
import { CodeBlock } from "@tiptap/extension-code-block";
import { Bold } from "@tiptap/extension-bold";
import { Italic } from "@tiptap/extension-italic";
import { Code } from "@tiptap/extension-code";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";

const extensions = [
  Document,
  Paragraph,
  Text,
  Heading.configure({ levels: [1, 2, 3] }),
  BulletList,
  OrderedList,
  ListItem,
  Blockquote,
  CodeBlock,
  Bold,
  Italic,
  Code,
  Link.configure({
    HTMLAttributes: {
      rel: "noopener noreferrer",
      target: "_blank",
    },
    protocols: ["http", "https", "mailto"],
  }),
  Image.configure({
    HTMLAttributes: { loading: "lazy" },
  }),
  HorizontalRule,
];

export function renderRichTextToHtml(json: unknown): string {
  return generateHTML(json as never, extensions);
}
```

Tiptap's link extension uses `protocols: ["http", "https", "mailto"]` to drop `javascript:` URLs at the renderer level.

## Layer 3: final HTML sanitization with `sanitize-html`

After the Tiptap renderer produces HTML, the output goes through `sanitize-html` with a strict allowlist. This is the belt-and-suspenders pass: even if Tiptap somehow emits a tag the allowlist did not anticipate, the post-render sanitizer scrubs it.

```typescript
// src/lib/rich-text/sanitize.ts
import sanitizeHtml from "sanitize-html";
import { env } from "@/lib/env";

const UPLOADTHING_HOST = new URL(env.UPLOADTHING_PUBLIC_URL).host;

export function sanitizeRichTextHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "p",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "code",
      "pre",
      "blockquote",
      "hr",
      "a",
      "img",
      "br",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt", "loading"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["https"],
    },
    allowedSchemesAppliedToAttributes: ["href", "src"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
      img: (tagName, attribs) => {
        try {
          const u = new URL(attribs.src);
          if (u.host !== UPLOADTHING_HOST) {
            return { tagName: "p", attribs: {}, text: "" };
          }
          return { tagName: "img", attribs };
        } catch {
          return { tagName: "p", attribs: {}, text: "" };
        }
      },
    },
  });
}
```

Two extra protections in the `transformTags` block:

- Every `<a>` is rewritten to carry `rel="noopener noreferrer"` and `target="_blank"`. Even an attacker-controlled link (which the user would have had to type in themselves) cannot use `window.opener`-based attacks.
- Every `<img>` has its `src` host checked against UploadThing's public URL host. An image hosted elsewhere is dropped (rendered as an empty paragraph). Restricting image hosts prevents hot-linking-as-tracking-pixel and prevents an attacker from referencing an image hosted on a URL they control to log opens of a proposal.

## Tying it together: the renderers

The two whitelisted `dangerouslySetInnerHTML` callers consume the output of Layers 2 and 3 only.

```typescript
// src/components/rich-text/proposal-block-renderer.tsx
import { renderRichTextToHtml } from "@/lib/rich-text/render";
import { sanitizeRichTextHtml } from "@/lib/rich-text/sanitize";

export function ProposalBlockRenderer({ json }: { json: unknown }) {
  const raw = renderRichTextToHtml(json);
  const safe = sanitizeRichTextHtml(raw);
  return <div className="prose" dangerouslySetInnerHTML={{ __html: safe }} />;
}
```

```typescript
// src/components/rich-text/update-renderer.tsx
import { renderRichTextToHtml } from "@/lib/rich-text/render";
import { sanitizeRichTextHtml } from "@/lib/rich-text/sanitize";

export function UpdateRenderer({ json }: { json: unknown }) {
  const raw = renderRichTextToHtml(json);
  const safe = sanitizeRichTextHtml(raw);
  return <article className="prose" dangerouslySetInnerHTML={{ __html: safe }} />;
}
```

Three layers (schema, renderer, sanitizer) and a CI rule enforcing the file boundary. A bug in any one layer is a degraded defense, not a leak.

## Email rendering

React Email templates render to HTML on the server before going to Resend. The same sanitizer applies to user-customizable fields:

- The freelancer's signature block (markdown). Rendered with `marked` to HTML, then run through `sanitize-html` with the same allowlist as rich-text.
- The freelancer's customized subject (per-template, supports `{variable}` syntax). The variable expansion runs *before* the subject is rendered into the email; values from `{client_name}`, `{project_name}`, etc. are HTML-encoded with a small helper that handles `&`, `<`, `>`, `"`, `'`. (Email subject lines are not HTML, but providers occasionally render them in HTML preview panes; encoding makes the rendering identical regardless.)
- The freelancer's customized body (per-template, markdown, supports `{variable}` syntax). Rendered through `marked` and `sanitize-html` exactly like the signature.

System-defined templates (`welcome`, `password-reset`, `email-verify`) interpolate user data only into safe positions: a name into a salutation (escaped by React), a URL into an `<a href>` (validated to start with `https://` and to point to the application's own host).

## Public proposal accept

The accept form takes `signatureName` and `signatureEmail`. Both are validated by zod (`min(1).max(100)` on the name, `email().max(254)` on the email). The values are rendered back on the confirmation page through React's default escaping. They are never passed to a `dangerouslySetInnerHTML` and never included in HTML email content unescaped.

The accepted signature is shown to the freelancer on the proposal status page as a typed name with a small acceptance timestamp. The freelancer's view also runs through React's default escaping; an attacker submitting `<script>alert(1)</script>` as their signature sees the literal string echoed back (which is exactly the deterrent).

## Content-Security-Policy

CSP runs as a defense-in-depth header. Even if a payload survives all three layers above, CSP refuses to execute scripts that did not come from an allowed origin.

```typescript
// src/middleware.ts (excerpt)
const csp = [
  "default-src 'self'",
  "script-src 'self' 'nonce-${nonce}' https://plausible.io https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://utfs.io",
  "font-src 'self' data:",
  "connect-src 'self' https://api.resend.com https://plausible.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

response.headers.set("Content-Security-Policy", csp);
```

Notes on the policy:

- `script-src 'self' 'nonce-${nonce}'` allows only same-origin scripts and inline scripts that carry the per-request nonce. Plausible (analytics) and a third-party origin if loaded need explicit allowlisting.
- `style-src 'unsafe-inline'` is necessary for Tailwind's inline class injection during SSR. The mitigation is that style-only injection is much narrower than script injection (no `expression()` in modern browsers, no JavaScript execution from CSS). Considered acceptable for v1.
- `img-src` allows `data:` for inline favicons and `utfs.io` for UploadThing-hosted images.
- `frame-ancestors 'none'` blocks any other site from iframing the application; clickjacking is mitigated.
- `connect-src` is enumerated; new third-party endpoints require an explicit addition to the policy.

CSP violations are reported only in development (the report URI is the local dev server). v2 wires up a hosted report-uri service.
