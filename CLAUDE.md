# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server on :5173
npm run build     # tsc -b && vite build  → dist/
npm run preview   # serve the production build
```

There is no test framework and no linter. `npm run build` is the only automated gate — it typechecks all three tsconfig projects before bundling. Verify behavior by driving the app in a browser; the states worth exercising are listed under "Verifying changes" below.

## What this is

A single-page, frontend-only tool. The user uploads two images (a person and a garment), the app POSTs both to an n8n webhook as `multipart/form-data`, and n8n returns one merged image as a binary blob. The original spec lives at `../````markdown_PRD.txt`.

## Architecture

Data flows in one direction: `App.tsx` owns all cross-cutting state (`status`, `errorMessage`, `resultUrl`) and passes it down. The two upload tiles are the only stateful children, and each owns its file through a `useImageSlot` instance.

- `lib/constants.ts` — webhook URL, accepted MIME types, size cap. `ACCEPT_ATTR` duplicates `ACCEPTED_TYPES` for the file picker and is kept in sync by hand.
- `lib/validate.ts` — `validateFile` is the single validation entry point. Both the file input and the drop handler call it, so drag-and-drop cannot bypass the `accept` attribute.
- `lib/api.ts` — the only place that talks to the network.
- `hooks/useImageSlot.ts` — one upload slot's file plus its object URL.
- `components/` — presentational; `ImageDropTile` holds local drag/error state only.

### Object URL ownership

Two owners, and they must not overlap: `useImageSlot` owns preview URLs for the inputs, `App.tsx` owns `resultUrl` via `resultUrlRef`. Each revokes the old URL before creating a new one and again on unmount. When adding any new `URL.createObjectURL` call, put it behind one of these two owners rather than creating URLs inline in a component.

### The webhook contract

Three things are load-bearing and easy to break:

1. **Field names must be exactly `image1` and `image2`.** n8n matches on them.
2. **Never set a `Content-Type` header on the request.** The browser has to write the multipart boundary itself; setting the header by hand produces a body n8n cannot parse.
3. **A 200 does not mean you got an image.** n8n returns JSON error bodies with a 200 status, so `api.ts` checks `blob.size` and `blob.type.startsWith("image/")` before resolving. Do not remove those checks.

### CORS shapes the deployment

Verified against the live webhook: n8n sends `Access-Control-Allow-Origin` on **successful** responses, so the browser calls it directly and no proxy is needed.

Error responses do **not** carry those headers. A failing webhook gets blocked by the browser, `fetch` itself rejects, and the UI reports "Could not reach the server" rather than the generic message — so a genuine n8n 500 reads to the user as a connectivity problem. This is a known limitation of calling the webhook directly, not a bug in `api.ts`.

**Do not route this call through a Vercel serverless function.** A measured round trip is ~20s; Hobby functions default to a 10s cap (60s max), so proxying would introduce timeouts that the direct call does not have.

## Design direction

The UI deliberately follows `page_inspiration.jpg` (Rinascente — a white editorial luxury-retail page): white field, `#111` ink, hairline `#e5e5e5` rules, wide-tracked uppercase type, `#f4f4f4` image tiles, solid-black primary button.

**The PRD's "Design Direction" section says dark background. That is intentionally not followed** — the acceptance criteria require matching the reference screenshot, and the user confirmed the reference wins. Do not "fix" the light theme.

Other conventions:

- The accent red `#e8563f` (from the reference's "PROMO" nav item) is reserved exclusively for error text. Do not use it decoratively.
- Design tokens live in the `@theme` block of `src/index.css`. This is **Tailwind v4** — there is no `tailwind.config.js` and adding one is not how you configure it. New tokens go in `@theme` and become utilities automatically (`--color-ink` → `text-ink`, `bg-ink`).
- The result image uses `object-contain`, the input previews use `object-cover`. The result must never be cropped — it is the app's output.

## Verifying changes

The states that have regressed or are easy to break, in rough order of value:

- **Duplicate submit** — clicking Generate rapidly must produce exactly one network request. Guarded by both the `disabled` prop and a `busy` check inside `onGenerate`; an `AbortController` cancels any in-flight run.
- **Validation** — reject a non-image and an oversize file, through *both* the picker and drag-and-drop.
- **Gating** — Generate stays disabled until both slots are filled.
- **Full round trip** — expect ~20s; confirm the request payload shows parts named `image1`/`image2` and a browser-generated multipart boundary.
- **Error state** — temporarily point `WEBHOOK_URL` at a bad path, then revert.

`performance.getEntriesByType("resource").filter(e => e.name.includes("n8n.cloud"))` is a quick way to count outbound calls from the console.
