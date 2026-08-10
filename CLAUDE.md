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

`.env` is gitignored, so a fresh clone has none. It needs three values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_STRIPE_PAYMENT_LINK`. Any one missing and `constants.ts` sets `CONFIG_ERROR`, so the app renders an on-screen explanation instead of mounting. Vite only reads `.env` at startup — **restart the dev server after editing it**, HMR will not pick it up.

There is deliberately **no `VITE_WEBHOOK_URL`**. The n8n URL is the `N8N_WEBHOOK_URL` secret on the Supabase project, read by the `generate` Edge Function. Putting it back into a `VITE_` variable would re-open the hole described under "Security posture".

There is no test framework and no linter. `npm run build` is the only automated gate — it typechecks all three tsconfig projects before bundling. Verify behavior by driving the app in a browser; the states worth exercising are listed under "Verifying changes" below.

## What this is

A single-page tool behind a Supabase email/password login **and a $9.99 one-time paywall**. The user signs up, pays through a Stripe Payment Link, then uploads two images (a person and a garment). The app POSTs both as `multipart/form-data` to a Supabase Edge Function, which checks the purchase and forwards to an n8n webhook that returns one merged image as a binary blob. The original spec lives at `../````markdown_PRD.txt`; auth and payment are additions to it.

The repo now carries a `supabase/functions/` directory. Those files are the source of truth for what is deployed, but deploying is a separate act — editing them changes nothing until they are pushed to the project.

## Architecture

`App.tsx` holds two gates. `App` renders `AuthScreen` when signed out and `PaidGate` when signed in; `PaidGate` renders `Paywall` or `Studio` depending on `useEntitlement`. `Studio` (same file) owns all cross-cutting tool state (`status`, `errorMessage`, `resultUrl`) and passes it down. The two upload tiles are the only stateful children, and each owns its file through a `useImageSlot` instance.

Keeping `Studio` a separate component is deliberate — its state, including the two object-URL owning slots, is created on entry and torn down on exit rather than lingering behind the login or paywall screen.

**`PaidGate` decides what renders; it does not protect anything.** The enforcement is in the `generate` Edge Function. Treat the client gate as presentation and never move a check *out* of the function and into React.

- `lib/constants.ts` — all three env values, the derived `GENERATE_URL`, plus accepted MIME types and the size cap. Every value is validated at module scope and the first problem becomes `CONFIG_ERROR`; nothing throws at import, because a throw blanks the page before React can explain itself. `ACCEPT_ATTR` duplicates `ACCEPTED_TYPES` for the file picker and is kept in sync by hand.
- `lib/validate.ts` — the single validation entry point for both files (`validateFile`) and credentials (`validateCredentials`). The auth form sets `noValidate` so the browser's native bubble cannot preempt it.
- `lib/api.ts` — the call to the `generate` Edge Function. `lib/supabase.ts` — the only `createClient`.
- `lib/authErrors.ts` — allowlist mapping `AuthError.code` to copy. Raw auth-server messages never reach the screen; unmapped codes fall back to `GENERIC_ERROR`.
- `hooks/useAuth.tsx` — `AuthProvider` + `useAuth()`. `onAuthStateChange` is the **single writer** of session state; the `signIn`/`signUp` actions only return a message to display. `loading` starts true so an already-signed-in reload never flashes the login screen.
- `hooks/useImageSlot.ts` — one upload slot's file plus its object URL.
- `hooks/useEntitlement.ts` — reads `public.purchases` through the select-own policy. Polls when the URL carries `?paid=1`, because Stripe's redirect can outrun the webhook by a second or two; the flag is consumed in a `useState` initialiser rather than an effect, so StrictMode's double mount cannot swallow it.
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

### Payments

- **`client_reference_id` is the join key.** `Paywall.tsx` appends the Supabase user id to the Payment Link URL; Stripe echoes it into the checkout session and then the webhook, which is the only reason an anonymous card payment can be attributed to an account. **Do not switch to matching on email** — the buyer can type any address on Stripe's page.
- **`public.purchases` has no insert or update policy**, exactly like `profiles`. The `stripe-webhook` function's service role is the only writer. Adding a client-side insert would let anyone grant themselves access with one console call.
- **`stripe_checkout_session_id` is unique, and that is what makes fulfilment idempotent.** Stripe redelivers webhooks freely; the upsert relies on that constraint to make a redelivery a no-op instead of a second purchase.
- **`stripe-webhook` must stay deployed with `verify_jwt = false`.** Stripe cannot send a Supabase JWT. The signature check *is* the authentication, which is why the function verifies it against the raw request text before parsing — parse-then-reserialise breaks the HMAC.
- The handler returns **200 for events it cannot act on** (unknown user, missing `client_reference_id`) and **500 only for transient faults**. Stripe retries anything non-2xx, so acking the permanently-broken ones is deliberate.
- Email confirmation being off matters here too: a user must reach the paywall to pay, and a paid user who could not sign in would be a support problem with real money attached.

### The generate contract

Five things are load-bearing and easy to break. The first three now apply to the Edge Function's call to n8n, not the browser's:

1. **Field names must be exactly `image1` and `image2`.** n8n matches on them. The function rebuilds the FormData rather than streaming the body through, so the names are re-asserted there.
2. **Never set a `Content-Type` header on the request.** `fetch` has to write the multipart boundary itself; setting the header by hand produces a body n8n cannot parse. This is true in the Edge Function exactly as it was in the browser.
3. **A 200 does not mean you got an image.** n8n returns JSON error bodies with a 200 status, so both the function and `api.ts` check `blob.size` and match the MIME against the `RESULT_TYPES` allowlist. The allowlist is deliberate — a `startsWith("image/")` test would admit `image/svg+xml`, an active-content format the app also hands to the user as a download. Do not loosen it back to a prefix check, in either copy.
4. **The client must send `Authorization: Bearer <access_token>`.** Without it the function returns 401 and the studio reports an expired session.
5. **Status codes are the error channel.** 401 expired session, 402 unpaid, 502 n8n failed. Unlike the old direct call — where an n8n 500 was indistinguishable from being offline, because error responses carry no CORS headers — these are now genuinely distinguishable. `api.ts` maps each to its own message; keep that mapping in sync with the function.

Timeouts are no longer the constraint they were. Round trips measured 20s–40s, against a Vercel Hobby cap of 10s (60s maximum) — which is why a Vercel proxy was rejected — but Supabase Edge Functions allow far more, and the call is I/O wait rather than CPU. The function sets its own 120s ceiling so it fails on our terms.

## Security posture

`vercel.json` sets CSP, HSTS, `nosniff`, `frame-ancestors 'none'`, and a restrictive `Permissions-Policy` on every route. **The CSP `connect-src` hardcodes the Supabase origin** — changing `VITE_SUPABASE_URL` to a different host without updating `connect-src` will cause the browser to block every auth call, every entitlement read and every generation, so the app looks entirely broken rather than degraded. The n8n origin was removed from `connect-src` when generation moved server-side; the browser no longer contacts n8n at all, and putting it back would be a signal that someone re-introduced a direct call.

`form-action 'none'` is compatible with the auth form only because submits are JS-handled. Do not switch to a real form POST or add an OAuth provider that redirects via form submission without revisiting it. The paywall's link to Stripe is a plain top-level navigation, which CSP does not restrict — do not "fix" it into a form POST.

**The n8n webhook is no longer publicly callable, and that is load-bearing now that access is sold.** The URL lives in the `N8N_WEBHOOK_URL` Supabase secret and is used only by the `generate` function, which resolves the caller's token to a real user and requires a `paid` row first. Moving that URL back into a `VITE_` variable, or letting the browser call n8n directly "just for debugging", hands every visitor a free endpoint and voids the paywall. This is the one change in the codebase that must not be quietly undone.

`PaidGate` in `App.tsx` is **presentation only**, in the same way the login gate always was: it decides what React renders and can be defeated in devtools. That is acceptable precisely because the function re-checks. Never describe the client gate as the paywall.

Both remaining `VITE_` values are public by design. `VITE_SUPABASE_PUBLISHABLE_KEY` is *meant* to ship to browsers — row level security, not obscurity, protects the data behind it. `VITE_STRIPE_PAYMENT_LINK` is a Stripe-hosted page for a fixed price; knowing it lets a stranger pay us. The service role key is a real secret, must never carry a `VITE_` prefix, and exists only inside the Edge Functions where the platform injects it.

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
- **Paywall enforcement** — the test that distinguishes a real paywall from a rendered one. POST to `/functions/v1/generate` with an unpaid user's token and expect **402**; with no token, **401**. Do this from the console, not the UI, because the UI will not offer the button.
- **Purchase round trip** — pay with test card `4242 4242 4242 4242`, then confirm a `purchases` row with the right `user_id` and that the Paywall flips to the Studio without a manual reload.
- **Fulfilment idempotency** — re-inserting the same `stripe_checkout_session_id` must be rejected by the unique constraint. Stripe redelivers, and a second row would be a second purchase.
- **Refund revokes** — refunding the charge flips `status` to `refunded` and returns the account to the Paywall.
- **Error state** — temporarily set the `N8N_WEBHOOK_URL` secret to a bad path (no redeploy needed; secrets are read at invocation), then revert.
- **Session persistence** — reload while signed in. Staying signed in with no flash of the login screen proves both `persistSession` and the `loading` gate in `App.tsx`.
- **Auth validation** — empty name, malformed email, and a short password must each show the app's own message. If you see an OS-styled bubble in the browser's language instead, `noValidate` has been lost from the form.
- **Profile trigger** — after a signup, `select name, email from public.profiles` must show the submitted name. An empty name means the `options.data.name` path broke.
- **Sign up** — a new account lands in the studio directly. A "check your inbox" screen instead means email confirmation got switched back on; "Too many attempts" on a first submission means it is on *and* the built-in email sender's hourly quota is spent. `get_logs` for the `auth` service names the real error in both cases.

`performance.getEntriesByType("resource").filter(e => e.name.includes("/functions/v1/generate"))` is a quick way to count outbound calls from the console. (It used to filter on `n8n.cloud`; a hit on that string now would mean someone re-introduced a direct browser call.)

Supabase `get_logs` for the `edge-function` service is where the function's own `console.error` output lands — the first place to look when generation fails or a webhook does not fulfil.
