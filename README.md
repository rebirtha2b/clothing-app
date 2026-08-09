# Image Merge

A single-page tool for AI virtual try-on. Upload a photo of a person and a photo of a garment; the app posts both to an n8n webhook and displays the merged result.

Frontend-only — there is no backend in this repo. All generation happens in the n8n workflow.

**Stack:** Vite · React 19 · TypeScript · Tailwind v4

## Setup

```bash
git clone https://github.com/rebirtha2b/clothing-app.git
cd clothing-app
npm install
cp .env.example .env    # then edit it — see below
npm run dev             # http://localhost:5173
```

`.env` is gitignored, so a fresh clone has none. The app throws at startup if `VITE_WEBHOOK_URL` is missing, rather than failing silently at request time.

| Variable | Description |
|---|---|
| `VITE_WEBHOOK_URL` | The n8n webhook that accepts the two images and returns one merged image. |

Vite reads `.env` only at startup — restart the dev server after editing it.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server with HMR on :5173 |
| `npm run build` | Typechecks (`tsc -b`) then bundles to `dist/` |
| `npm run preview` | Serves the production build locally |

There is no test suite; `npm run build` is the automated gate.

## How it works

1. Both files are validated client-side — JPG/PNG/WEBP only, 10 MB max each.
2. On submit, they're sent as `multipart/form-data` with the field names `image1` and `image2`.
3. The response is read as a binary blob, checked against a raster MIME allowlist, and rendered from an object URL.
4. The result can be downloaded with its correct file extension.

The Generate button stays disabled until both images are present, and an in-flight request cannot be double-submitted.

Expect **20–40 seconds** for a generation. That is the n8n workflow's own runtime, not a frontend delay.

## Deploying (Vercel)

A static SPA — Vercel auto-detects the Vite preset, no build configuration needed.

Two things are required:

1. **Set `VITE_WEBHOOK_URL`** in Project → Settings → Environment Variables. The build fails without it.
2. **If you change the webhook's host,** update `connect-src` in `vercel.json` to match. The Content-Security-Policy pins the n8n origin, and a mismatch means the browser blocks every request.

`vercel.json` also sets HSTS, `nosniff`, `frame-ancestors 'none'`, and a restrictive `Permissions-Policy`.

## A note on the webhook URL

**`VITE_WEBHOOK_URL` is configuration, not a secret.** Vite inlines `VITE_*` variables into the JavaScript bundle at build time, so the URL is readable by anyone who opens DevTools on the deployed site. Keeping it in `.env` means it stays out of git and can differ per environment — it does not make it private.

Anyone who reads it can call the workflow and consume the n8n account's execution quota. Closing that properly requires the endpoint to stop being reachable from the browser: either authentication enforced inside the n8n workflow with the credential held server-side, or a backend proxy that keeps the real URL private. Note that a proxy on Vercel Hobby must contend with a 60s function ceiling against a call that has been measured at 40s.

Keep this repository private until one of those is in place.
