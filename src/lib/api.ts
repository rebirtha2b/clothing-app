import {
  GENERATE_URL,
  GENERIC_ERROR,
  RESULT_TYPES,
  SUPABASE_PUBLISHABLE_KEY,
} from "./constants";

/**
 * Posts both images to the `generate` Edge Function, which verifies the
 * caller's session and purchase before forwarding them to n8n and returns the
 * merged image.
 *
 * No Content-Type header is set: the browser has to write the multipart
 * boundary itself, and setting it by hand produces a body n8n cannot parse.
 */
export async function generate(
  image1: File,
  image2: File,
  signal: AbortSignal,
  accessToken: string,
): Promise<Blob> {
  // Unreachable while main.tsx gates on CONFIG_ERROR, but a POST to "" would
  // silently hit the app's own origin, so refuse it explicitly.
  if (!GENERATE_URL) throw new Error(GENERIC_ERROR);
  if (!accessToken) throw new Error("Your session has expired. Sign in again.");

  const formData = new FormData();
  formData.append("image1", image1);
  formData.append("image2", image2);

  let response: Response;
  try {
    response = await fetch(GENERATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: formData,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Could not reach the server. Check your connection.");
  }

  if (!response.ok) {
    // The function reports failures as JSON with real status codes, so unlike
    // the old direct-to-n8n call these are distinguishable.
    if (response.status === 401) {
      throw new Error("Your session has expired. Sign in again.");
    }
    if (response.status === 402) {
      throw new Error("This account has not been unlocked yet.");
    }
    if (response.status === 502) {
      throw new Error("The image service did not respond. Please try again.");
    }
    throw new Error(GENERIC_ERROR);
  }

  const blob = await response.blob();

  // The function already checks this, but the browser is what renders the
  // result, so it validates what it actually received.
  if (blob.size === 0) {
    throw new Error("The server returned an empty response.");
  }
  // Match against an explicit raster allowlist rather than an "image/" prefix,
  // which would also admit image/svg+xml.
  const mime = blob.type.split(";")[0].trim().toLowerCase();
  if (!(RESULT_TYPES as readonly string[]).includes(mime)) {
    throw new Error("The server did not return a supported image.");
  }

  // Re-wrap so the downloaded file carries the type we actually validated,
  // rather than whatever the response header claimed.
  return new Blob([blob], { type: mime });
}
