# Image Merge

A single-page tool for AI virtual try-on. Sign in, upload a photo of a person and a photo of a garment; the app posts both to an n8n webhook and displays the merged result.

Frontend-only — there is no backend in this repo. Accounts live in Supabase Auth; all generation happens in the n8n workflow.

**Stack:** Vite · React 19 · TypeScript · Tailwind v4 · Supabase Auth

## Setup

```bash
git clone https://github.com/rebirtha2b/clothing-app.git
cd clothing-app
npm install
cp .env.example .env    # then edit it — see below
npm run dev             # http://localhost:5173
```

`.env` is gitignored, so a fresh clone has none. If any variable below is missing the app renders an on-screen explanation naming it, rather than failing silently at request time.

| Variable | Description |
|---|---|
| `VITE_WEBHOOK_URL` | The n8n webhook that accepts the two images and returns one merged image. |
| `VITE_SUPABASE_URL` | Your Supabase project URL, e.g. `https://xxxx.supabase.co`. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The Supabase publishable key (`sb_publishable_…`). Safe in the browser — never use the service role key here. |

Vite reads `.env` only at startup — restart the dev server after editing it.

### Supabase setup

The database side is one migration: a `public.profiles` table keyed to `auth.users`, row level security limiting each user to their own row, and an `on_auth_user_created` trigger that copies the name supplied at sign-up into it.

In the dashboard, under **Authentication → Sign In / Providers → Email**, keep **Confirm email** off. Sign-up then returns a session and the user is in straight away.

Turning it on without configuring custom SMTP first will break sign-up entirely: Supabase's built-in email sender allows only a couple of messages per hour, so attempts fail with `429 over_email_send_rate_limit` and no account is created. The app surfaces that as "Too many attempts", which is confusing on a form submitted once — check **Logs → Auth** if you see it.

The client already handles the confirmation flow (a "check your inbox" screen, and the emailed link signs the user in on return), so enabling it needs no code change — only custom SMTP, plus every origin listed under **Authentication → URL Configuration** as a Redirect URL.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server with HMR on :5173 |
| `npm run build` | Typechecks (`tsc -b`) then bundles to `dist/` |
| `npm run preview` | Serves the production build locally |

There is no test suite; `npm run build` is the automated gate.

## How it works

Signed-out visitors get the sign-in / create-account screen and nothing else. Sign-up takes a name, email and password; the name is stored on the account and mirrored into `profiles`, and the new user is signed in immediately. Sessions persist across reloads, and sign-out returns you to the login screen.

Once signed in:

1. Both files are validated client-side — JPG/PNG/WEBP only, 10 MB max each.
2. On submit, they're sent as `multipart/form-data` with the field names `image1` and `image2`.
3. The response is read as a binary blob, checked against a raster MIME allowlist, and rendered from an object URL.
4. The result can be downloaded with its correct file extension.

The Generate button stays disabled until both images are present, and an in-flight request cannot be double-submitted.

Expect **20–40 seconds** for a generation. That is the n8n workflow's own runtime, not a frontend delay.

## Deploying (Vercel)

A static SPA — Vercel auto-detects the Vite preset, no build configuration needed.

Two things are required:

1. **Set all three variables** in Project → Settings → Environment Variables, then redeploy — Vite compiles them into the bundle at build time, so setting them alone does not change a deployment already live.
2. **If you change the webhook's or Supabase project's host,** update `connect-src` in `vercel.json` to match. The Content-Security-Policy pins both origins, and a mismatch means the browser blocks every request to that host — a wrong Supabase origin breaks sign-in entirely.

`vercel.json` also sets HSTS, `nosniff`, `frame-ancestors 'none'`, and a restrictive `Permissions-Policy`.

## A note on the webhook URL

**`VITE_WEBHOOK_URL` is configuration, not a secret.** Vite inlines `VITE_*` variables into the JavaScript bundle at build time, so the URL is readable by anyone who opens DevTools on the deployed site. Keeping it in `.env` means it stays out of git and can differ per environment — it does not make it private.

Anyone who reads it can call the workflow and consume the n8n account's execution quota. **The login screen does not change this** — it gates the interface, not the endpoint. Closing it properly requires the endpoint to stop being reachable from the browser: either authentication enforced inside the n8n workflow with the credential held server-side, or a proxy that keeps the real URL private and checks the caller's session (a Supabase Edge Function is the natural fit now that auth exists). Note that a proxy on Vercel Hobby must contend with a 60s function ceiling against a call that has been measured at 40s.

The Supabase publishable key is a different matter — it is meant to be public, and row level security is what protects the data behind it.

Keep this repository private until one of those is in place.
