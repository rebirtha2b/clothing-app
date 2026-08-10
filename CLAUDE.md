# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
cp .env.example .env   # required first — see below
npm install
npm run dev       # Vite dev server on :5173
npm run build     # tsc -b && vite build  → dist/
npm run preview   # serve the production build
```

`.env` is gitignored, so a fresh clone has none. It needs three values: `VITE_WEBHOOK_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Any one missing and `constants.ts` sets `CONFIG_ERROR`, so the app renders an on-screen explanation instead of mounting. Vite only reads `.env` at startup — **restart the dev server after editing it**, HMR will not pick it up.

There is no test framework and no linter. `npm run build` is the only automated gate — it typechecks all three tsconfig projects before bundling. Verify behavior by driving the app in a browser; the states worth exercising are listed under "Verifying changes" below.

## What this is

A single-page, frontend-only tool behind a Supabase email/password login. The user signs in, uploads two images (a person and a garment), the app POSTs both to an n8n webhook as `multipart/form-data`, and n8n returns one merged image as a binary blob. The original spec lives at `../````markdown_PRD.txt`; auth is an addition to it.

## Architecture

`App.tsx` is the auth gate and nothing else: it renders `AuthScreen` when signed out and `Studio` when signed in. `Studio` (same file) owns all cross-cutting tool state (`status`, `errorMessage`, `resultUrl`) and passes it down. The two upload tiles are the only stateful children, and each owns its file through a `useImageSlot` instance.

Keeping `Studio` a separate component is deliberate — its state, including the two object-URL owning slots, is created on sign in and torn down on sign out rather than lingering behind the login screen.

- `lib/constants.ts` — all three env values plus accepted MIME types and the size cap. Every value is validated at module scope and the first problem becomes `CONFIG_ERROR`; nothing throws at import, because a throw blanks the page before React can explain itself. `ACCEPT_ATTR` duplicates `ACCEPTED_TYPES` for the file picker and is kept in sync by hand.
- `lib/validate.ts` — the single validation entry point for both files (`validateFile`) and credentials (`validateCredentials`). The auth form sets `noValidate` so the browser's native bubble cannot preempt it.
- `lib/api.ts` — the n8n call. `lib/supabase.ts` — the only `createClient`.
- `lib/authErrors.ts` — allowlist mapping `AuthError.code` to copy. Raw auth-server messages never reach the screen; unmapped codes fall back to `GENERIC_ERROR`.
- `hooks/useAuth.tsx` — `AuthProvider` + `useAuth()`. `onAuthStateChange` is the **single writer** of session state; the `signIn`/`signUp` actions only return a message to display. `loading` starts true so an already-signed-in reload never flashes the login screen.
- `hooks/useImageSlot.ts` — one upload slot's file plus its object URL.
- `components/` — presentational; `ImageDropTile` and `AuthScreen` hold local state only.

### Auth

- The **name comes from `signUp` metadata**, not a client insert: `options.data.name` lands in `auth.users.raw_user_meta_data`, and the `on_auth_user_created` trigger copies it into `public.profiles`. There is deliberately **no insert policy** on `profiles` — the trigger is the only writer. Adding a client-side insert would create a second, divergent path.
- The trigger is `security definer set search_path = ''`, so everything inside it must stay schema-qualified, and `EXECUTE` is revoked from `anon`/`authenticated` to keep it off the REST RPC surface. Any error it raises surfaces to the user as a failed signup.
- **Email confirmation is off**, so `signUp` returns a session and the user lands in the studio immediately.

  It was briefly on, and that made signup unusable: the built-in Supabase sender allows only a couple of emails per hour, so every attempt after the first returned `429 over_email_send_rate_limit` and no account was created. **Do not turn confirmation back on without configuring custom SMTP first** — the failure looks like a mysterious "too many attempts" on a form that has been submitted once.

- The client nevertheless handles the confirmation flow, so flipping that switch needs no code change: `signUp` returns `{ error, needsConfirmation }`, and `AuthScreen` shows a "check your inbox" state when a signup succeeds without a session. `emailRedirectTo` is set to `window.location.origin` and `detectSessionInUrl` is on so the emailed link would sign the user in on return. That branch is currently unreachable — keep it working rather than deleting it as dead code.
- If confirmation is ever re-enabled, **every origin must be listed under Authentication → URL Configuration** or the link falls back to the project's Site URL.
- Login gates the **UI only**. The n8n webhook URL is still in the bundle and still publicly callable — see below.

### Object URL ownership

Two owners, and they must not overlap: `useImageSlot` owns preview URLs for the inputs, `App.tsx` owns `resultUrl` via `resultUrlRef`. Each revokes the old URL before creating a new one and again on unmount. When adding any new `URL.createObjectURL` call, put it behind one of these two owners rather than creating URLs inline in a component.

### The webhook contract

Three things are load-bearing and easy to break:

1. **Field names must be exactly `image1` and `image2`.** n8n matches on them.
2. **Never set a `Content-Type` header on the request.** The browser has to write the multipart boundary itself; setting the header by hand produces a body n8n cannot parse.
3. **A 200 does not mean you got an image.** n8n returns JSON error bodies with a 200 status, so `api.ts` checks `blob.size` and matches the MIME against the `RESULT_TYPES` allowlist before resolving. The allowlist is deliberate — a `startsWith("image/")` test would admit `image/svg+xml`, which is an active-content format that the app also hands to the user as a download. Do not loosen it back to a prefix check.

### CORS shapes the deployment

Verified against the live webhook: n8n sends `Access-Control-Allow-Origin` on **successful** responses, so the browser calls it directly and no proxy is needed.

Error responses do **not** carry those headers. A failing webhook gets blocked by the browser, `fetch` itself rejects, and the UI reports "Could not reach the server" rather than the generic message — so a genuine n8n 500 reads to the user as a connectivity problem. This is a known limitation of calling the webhook directly, not a bug in `api.ts`.

**Think hard before routing this call through a Vercel serverless function.** Measured round trips have ranged 20s–40s against a Hobby default cap of 10s (60s maximum). A proxy would introduce timeouts the direct call does not have, and the observed variance leaves little headroom even at 60s. The one reason to accept that cost is moving the webhook server-side so it stops being publicly callable — see below.

## Security posture

`vercel.json` sets CSP, HSTS, `nosniff`, `frame-ancestors 'none'`, and a restrictive `Permissions-Policy` on every route. **The CSP `connect-src` hardcodes both the n8n origin and the Supabase origin** — changing `VITE_WEBHOOK_URL` or `VITE_SUPABASE_URL` to a different host without updating `connect-src` will cause the browser to block the request. Each pair must move together; a wrong Supabase origin blocks *every* auth call, so the app looks entirely broken rather than degraded.

`form-action 'none'` is compatible with the auth form only because submits are JS-handled. Do not switch to a real form POST or add an OAuth provider that redirects via form submission without revisiting it.

**`VITE_WEBHOOK_URL` is configuration, not a secret.** Vite inlines `VITE_*` variables into the bundle at build time; the URL is readable in DevTools on the deployed site. `.env` keeps it out of git and per-environment, nothing more. Anyone who reads it can POST to the workflow and consume the account's execution quota.

**Adding login did not change that.** The auth gate is client-side: it decides what React renders, and a signed-out visitor who reads the bundle can still call the webhook directly. Genuinely closing the hole needs the endpoint to stop being reachable from the client — auth enforced inside the n8n workflow with the credential held server-side, or a proxy (a Supabase Edge Function holding the URL as a real secret and checking the caller's JWT is the natural fit now, and avoids the Vercel timeout cost above). Do not present `.env` or the login screen as having solved it.

`VITE_SUPABASE_PUBLISHABLE_KEY` is the exception that proves the rule: it is *designed* to ship to browsers. Row level security is what protects the data behind it. The service role key is a real secret and must never carry a `VITE_` prefix.

## Design direction

Two references, each governing a different layer:

- **`page_inspiration.jpg`** (Rinascente) — the page shell: white field, `#111` ink, hairline `#e5e5e5` rules, wide-tracked uppercase type, header/nav/breadcrumb/footer chrome.
- **`better_frontend_style.jpg`** — the tool area: two upload cards side by side, then a **full-width result panel below**, not a third column. Cards are `rounded-xl` on `--color-card` (`#f7f8fa`), previews are contained rather than cropped, each shows its filename beneath, and a circular black `×` in the card corner removes the image. Primary and download buttons are compact, centered, solid black — not full-width.

**The PRD's "Design Direction" section says dark background. That is intentionally not followed** — the acceptance criteria require matching the reference screenshot, and the user confirmed the reference wins. Do not "fix" the light theme.

Other conventions:

- The accent red `#e8563f` (from the reference's "PROMO" nav item) is reserved exclusively for error text. Do not use it decoratively.
- Design tokens live in the `@theme` block of `src/index.css`. This is **Tailwind v4** — there is no `tailwind.config.js` and adding one is not how you configure it. New tokens go in `@theme` and become utilities automatically (`--color-ink` → `text-ink`, `bg-ink`).
- Every image uses `object-contain`. Nothing is ever cropped to fill a container — the result especially, since it is the app's output.

## Verifying changes

The states that have regressed or are easy to break, in rough order of value:

- **Duplicate submit** — clicking Generate rapidly must produce exactly one network request. Guarded by both the `disabled` prop and a `busy` check inside `onGenerate`; an `AbortController` cancels any in-flight run.
- **Validation** — reject a non-image and an oversize file, through *both* the picker and drag-and-drop.
- **Gating** — Generate stays disabled until both slots are filled.
- **Full round trip** — measured at 20s and 40s on separate runs, so allow a generous timeout before concluding it hung. Confirm the request payload shows parts named `image1`/`image2` and a browser-generated multipart boundary.
- **Error state** — temporarily point `VITE_WEBHOOK_URL` at a bad path and restart the dev server, then revert.
- **Session persistence** — reload while signed in. Staying signed in with no flash of the login screen proves both `persistSession` and the `loading` gate in `App.tsx`.
- **Auth validation** — empty name, malformed email, and a short password must each show the app's own message. If you see an OS-styled bubble in the browser's language instead, `noValidate` has been lost from the form.
- **Profile trigger** — after a signup, `select name, email from public.profiles` must show the submitted name. An empty name means the `options.data.name` path broke.
- **Sign up** — a new account lands in the studio directly. A "check your inbox" screen instead means email confirmation got switched back on; "Too many attempts" on a first submission means it is on *and* the built-in email sender's hourly quota is spent. `get_logs` for the `auth` service names the real error in both cases.

`performance.getEntriesByType("resource").filter(e => e.name.includes("n8n.cloud"))` is a quick way to count outbound calls from the console.
