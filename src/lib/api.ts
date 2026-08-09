import { GENERIC_ERROR, RESULT_TYPES, WEBHOOK_URL } from "./constants";

/**
 * Posts both images to the n8n webhook and returns the merged image.
 *
 * No Content-Type header is set: the browser has to write the multipart
 * boundary itself, and setting it by hand produces a body n8n cannot parse.
 */
export async function generate(
  image1: File,
  image2: File,
  signal: AbortSignal,
): Promise<Blob> {
  const formData = new FormData();
  formData.append("image1", image1);
  formData.append("image2", image2);

  let response: Response;
  try {
    response = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: formData,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Could not reach the server. Check your connection.");
  }

  if (!response.ok) {
    throw new Error(GENERIC_ERROR);
  }

  const blob = await response.blob();

  // n8n happily returns a 200 with a JSON error body, so an ok status is not
  // enough to conclude we got an image.
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
