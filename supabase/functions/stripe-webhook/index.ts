/**
 * Stripe -> Supabase fulfilment.
 *
 * Deployed with verify_jwt = false: Stripe cannot send a Supabase JWT, so the
 * Stripe signature IS the authentication. Nothing here trusts the body until
 * verifySignature has passed.
 *
 * The user is identified by client_reference_id, which the frontend appends to
 * the Payment Link URL. Matching on the customer's email instead would be
 * wrong — the buyer can type any address on Stripe's page.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Stripe rejects timestamps older than this; so do we, to blunt replays. */
const TOLERANCE_SECONDS = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time-ish compare; avoids leaking how much of the digest matched. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Implements Stripe's documented scheme rather than pulling in the Stripe SDK:
 * the SDK's constructEvent needs an API key we otherwise have no use for, and
 * the event payload already carries everything fulfilment needs.
 */
async function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header || !secret) return false;

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "t") timestamp = value ?? "";
    if (key?.trim() === "v1" && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${rawBody}`),
    ),
  );

  return signatures.some((candidate) => safeEqual(candidate, digest));
}

/** 200 with a reason: the event is understood but not actionable. Retrying it
 * would never help, and Stripe retries anything that is not 2xx. */
function ack(reason: string): Response {
  return new Response(JSON.stringify({ received: true, note: reason }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function grantAccess(session: Record<string, any>): Promise<Response> {
  if (session.payment_status !== "paid") {
    return ack(`payment_status is ${session.payment_status}`);
  }

  const userId = session.client_reference_id;
  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    console.error("checkout session has no usable client_reference_id", session.id);
    return ack("no client_reference_id");
  }

  const { data: found, error: lookupError } =
    await supabase.auth.admin.getUserById(userId);
  if (lookupError || !found?.user) {
    console.error("client_reference_id does not match a user", userId);
    return ack("unknown user");
  }

  // ignoreDuplicates + the unique constraint on the session id is what makes a
  // redelivered webhook a no-op instead of a second purchase row.
  const { error } = await supabase.from("purchases").upsert(
    {
      user_id: userId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent ?? null,
      stripe_customer_id:
        typeof session.customer === "string" ? session.customer : null,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? null,
      status: "paid",
    },
    { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true },
  );

  if (error) {
    // A 500 makes Stripe retry, which is what we want for a transient DB fault.
    console.error("purchase insert failed", error.message);
    return new Response(JSON.stringify({ error: "insert failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("access granted", userId, session.id);
  return ack("access granted");
}

async function revokeAccess(charge: Record<string, any>): Promise<Response> {
  const paymentIntent = charge.payment_intent;
  if (typeof paymentIntent !== "string") return ack("no payment_intent");

  const { error } = await supabase
    .from("purchases")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", paymentIntent);

  if (error) {
    console.error("refund update failed", error.message);
    return new Response(JSON.stringify({ error: "update failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("access revoked", paymentIntent);
  return ack("access revoked");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Must be the raw text: the signature covers the exact bytes Stripe sent, so
  // parsing and re-serialising first would break verification.
  const rawBody = await req.text();

  if (!(await verifySignature(rawBody, req.headers.get("stripe-signature"), WEBHOOK_SECRET))) {
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const object = event.data?.object ?? {};

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return await grantAccess(object);
    case "charge.refunded":
      return await revokeAccess(object);
    default:
      return ack(`ignored ${event.type}`);
  }
});
