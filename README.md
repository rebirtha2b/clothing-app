# Image Merge

A single-page tool for AI virtual try-on. Create an account, pay once, then upload a photo of a person and a photo of a garment; the app returns the merged result.

Access costs a flat **$9.99 one-time** fee, sold through a Stripe Payment Link. Accounts and purchases live in Supabase; generation happens in an n8n workflow, reached through a Supabase Edge Function that checks the caller has paid.

**Stack:** Vite · React 19 · TypeScript · Tailwind v4 · Supabase (Auth, Postgres, Edge Functions) · Stripe

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
| `VITE_SUPABASE_URL` | Your Supabase project URL, e.g. `https://xxxx.supabase.co`. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The Supabase publishable key (`sb_publishable_…`). Safe in the browser — never use the service role key here. |
| `VITE_STRIPE_PAYMENT_LINK` | The Stripe Payment Link for the unlock, e.g. `https://buy.stripe.com/…`. Public by design — it identifies a price, not an account. |

There is deliberately **no `VITE_WEBHOOK_URL`**. The n8n URL is a server-side secret now; see [Supabase setup](#supabase-setup).

Vite reads `.env` only at startup — restart the dev server after editing it.

### Supabase setup

Two tables, both with row level security:

- `public.profiles` — keyed to `auth.users`, each user limited to their own row, populated by an `on_auth_user_created` trigger that copies the name supplied at sign-up.
- `public.purchases` — one row per completed Stripe checkout. Users can read their own rows and nothing else; there is **no insert or update policy**, because the `stripe-webhook` Edge Function's service role is the only writer.

Two Edge Functions:

- `generate` — the paywall. Verifies the caller's session and that they have a `paid` purchase, then forwards the images to n8n.
- `stripe-webhook` — deployed with **`verify_jwt = false`** (Stripe cannot send a Supabase JWT; the Stripe signature is the authentication). Writes purchase rows on `checkout.session.completed`, and flips them to `refunded` on `charge.refunded`.

Both need secrets set under **Project Settings → Edge Functions → Secrets**:

| Secret | Value |
|---|---|
| `N8N_WEBHOOK_URL` | The n8n production webhook URL. |
| `STRIPE_WEBHOOK_SECRET` | The `whsec_…` signing secret from the Stripe webhook endpoint. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do not add them by hand.

### Stripe setup

1. A product with a **one-time** price of $9.99.
2. A **Payment Link** on that price, with *After payment → Redirect* pointing at your app origin with `?paid=1` (e.g. `http://localhost:5173/?paid=1` for local work). Put the link in `VITE_STRIPE_PAYMENT_LINK`.
3. A **webhook endpoint** at `https://<project>.supabase.co/functions/v1/stripe-webhook` subscribed to `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

The app appends `client_reference_id=<supabase user id>` to the link when it sends the user to Stripe. That is what ties an otherwise anonymous payment back to an account — the webhook reads it straight off the checkout session. Matching on the customer's email would be unreliable, because the buyer can type any address on Stripe's page.

Test and live mode are separate worlds: switching to live means recreating the product, price, link and webhook with live keys, then updating `VITE_STRIPE_PAYMENT_LINK` and `STRIPE_WEBHOOK_SECRET`. Clear any test-mode rows out of `purchases` before launch — they grant real access.

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

Signed in but unpaid, you get the paywall. "Continue to payment" sends you to Stripe with your user id attached; Stripe redirects you back with `?paid=1` once the charge succeeds. Fulfilment is asynchronous — the redirect can beat the webhook by a second or two — so the app polls for up to 90 seconds rather than concluding you have not paid. There is also an "Already paid? Check again" button for the case where you closed the tab mid-flow.

Once signed in and paid:

1. Both files are validated client-side — JPG/PNG/WEBP only, 10 MB max each.
2. On submit, they're sent as `multipart/form-data` with the field names `image1` and `image2` to the `generate` Edge Function, with the session's access token in the `Authorization` header.
3. The function re-checks the session and the purchase, forwards to n8n, and validates the reply before returning it.
4. The response is read as a binary blob, checked against a raster MIME allowlist, and rendered from an object URL.
5. The result can be downloaded with its correct file extension.

The Generate button stays disabled until both images are present, and an in-flight request cannot be double-submitted.

Expect **20–40 seconds** for a generation. That is the n8n workflow's own runtime, not a frontend delay.

## Deploying (Vercel)

A static SPA — Vercel auto-detects the Vite preset, no build configuration needed.

Two things are required:

1. **Set all three variables** in Project → Settings → Environment Variables, then redeploy — Vite compiles them into the bundle at build time, so setting them alone does not change a deployment already live.
2. **If you change the Supabase project's host,** update `connect-src` in `vercel.json` to match. The Content-Security-Policy pins that origin, and a mismatch means the browser blocks every request to it — which breaks sign-in, the paywall check and generation all at once, so the app looks entirely broken rather than degraded.
3. **Point the Stripe Payment Link's redirect at the deployed origin**, not localhost, or paying customers land on a dead page after checkout.

`vercel.json` also sets HSTS, `nosniff`, `frame-ancestors 'none'`, and a restrictive `Permissions-Policy`.

## Where the paywall actually lives

In the `generate` Edge Function, not in React.

`App.tsx` chooses between the paywall and the studio, but that is only what gets *rendered*. Anything the browser decides can be un-decided in devtools. What makes this a real paywall is that the n8n URL is no longer in the bundle at all: it is a Supabase secret, and the only thing that will use it on your behalf is a function that first resolves your access token to a user and then looks up a `paid` row for them. Forge `paid` in the client and the Generate button returns 402.

This also closed a hole that predates the paywall. The app used to post to n8n directly, which meant the webhook URL shipped in the JavaScript and anyone who read it could burn the account's execution quota for free.

Two things are still public, correctly:

- **`VITE_STRIPE_PAYMENT_LINK`** — a Stripe-hosted checkout page for a fixed price. Knowing it lets you pay us $9.99.
- **`VITE_SUPABASE_PUBLISHABLE_KEY`** — designed to ship to browsers; row level security, not obscurity, protects the data behind it.

The service role key is a real secret and must never carry a `VITE_` prefix. It exists only inside the Edge Functions, where the platform injects it.
