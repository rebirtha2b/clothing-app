/**
 * Vite inlines VITE_* variables into the client bundle at build time, so this
 * URL is readable by anyone on the deployed site. It lives in .env for
 * configuration hygiene (per-environment, out of source control), not because
 * that makes it private. Never put a real secret behind a VITE_ prefix.
 */
const url = import.meta.env.VITE_WEBHOOK_URL;

if (!url) {
  throw new Error(
    "VITE_WEBHOOK_URL is not set. Copy .env.example to .env and fill it in.",
  );
}

export const WEBHOOK_URL: string = url;

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

/** What the file picker advertises. Kept in sync with ACCEPTED_TYPES by hand. */
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";

/**
 * Raster formats we will render from the webhook response. Deliberately
 * excludes image/svg+xml: SVG is an active-content format, and the result blob
 * is also offered as a download that a user may open directly.
 */
export const RESULT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const MAX_BYTES = 10 * 1024 * 1024;

export const GENERIC_ERROR = "Something went wrong. Please try again.";
