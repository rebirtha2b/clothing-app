/**
 * The paywall, and the only thing that knows the n8n webhook URL.
 *
 * Before this function existed the browser posted straight to n8n, so the URL
 * shipped in the bundle and anyone could call it for free. Gating in React
 * would not have changed that — a paid product needs the check on a server the
 * user cannot edit. Two things are verified here: a real signed-in user, and a
 * purchase row for that user.
 *
 * Deployed with verify_jwt = false so that an anonymous or malformed call gets
 * this function's own JSON 401 rather than the gateway's opaque one; the token
 * is still resolved to a real user below, which is the check that matters.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const N8N_WEBHOOK_URL = Deno.env.get("N8N_WEBHOOK_URL") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/**
 * Same allowlist as the client's constants.ts, enforced again here. Deliberately
 * excludes image/svg+xml: SVG is an active-content format and the result is
 * offered to the user as a download.
 */
const RESULT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** n8n has been measured at 20-40s. Fail on our terms before the platform does. */
const UPSTREAM_TIMEOUT_MS = 120_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function fail(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail(405, "method_not_allowed");

  // An anon-key JWT would satisfy gateway verification too, so resolving the
  // token to an actual user is what identifies the caller.
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user) return fail(401, "unauthorized");

  const { data: purchase, error: purchaseError } = await admin
    .from("purchases")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();

  if (purchaseError) {
    console.error("entitlement lookup failed", purchaseError.message);
    return fail(500, "lookup_failed");
  }
  if (!purchase) return fail(402, "payment_required");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "invalid_body");
  }

  const image1 = form.get("image1");
  const image2 = form.get("image2");
  if (!(image1 instanceof File) || !(image2 instanceof File)) {
    return fail(400, "missing_images");
  }

  // Field names are load-bearing: n8n matches on image1/image2 exactly. And no
  // Content-Type header — fetch has to write the multipart boundary itself, or
  // n8n cannot parse the body.
  const upstreamForm = new FormData();
  upstreamForm.append("image1", image1, image1.name);
  upstreamForm.append("image2", image2, image2.name);

  // Checked here rather than at the top of the handler so that a misconfigured
  // deployment still answers 401/402 honestly instead of masking every call.
  if (!N8N_WEBHOOK_URL) {
    console.error("N8N_WEBHOOK_URL secret is not set");
    return fail(500, "not_configured");
  }

  let upstream: Response;
  try {
    upstream = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      body: upstreamForm,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("n8n unreachable", String(error));
    return fail(502, "upstream_unreachable");
  }

  if (!upstream.ok) {
    console.error("n8n returned", upstream.status, (await upstream.text()).slice(0, 500));
    return fail(502, "upstream_error");
  }

  const blob = await upstream.blob();

  // n8n returns JSON error bodies with a 200 status, so an ok status is not
  // enough to conclude we got an image.
  if (blob.size === 0) return fail(502, "empty_result");

  const mime = blob.type.split(";")[0].trim().toLowerCase();
  if (!RESULT_TYPES.includes(mime)) {
    console.error("n8n returned unsupported type", blob.type);
    return fail(502, "unsupported_result");
  }

  return new Response(blob, {
    status: 200,
    headers: { ...CORS, "Content-Type": mime, "Cache-Control": "no-store" },
  });
});
