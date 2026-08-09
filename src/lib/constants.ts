/**
 * Vite inlines VITE_* variables into the client bundle at build time, so this
 * URL is readable by anyone on the deployed site. It lives in .env for
 * configuration hygiene (per-environment, out of source control), not because
 * that makes it private. Never put a real secret behind a VITE_ prefix.
 */
function readWebhookUrl(): { url: string; error: string | null } {
  const raw = import.meta.env.VITE_WEBHOOK_URL;

  if (!raw) return { url: "", error: "VITE_WEBHOOK_URL is not set." };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { url: "", error: "VITE_WEBHOOK_URL is not a valid URL." };
  }
  if (parsed.protocol !== "https:") {
    return { url: "", error: "VITE_WEBHOOK_URL must use https." };
  }

  return { url: raw, error: null };
}

const config = readWebhookUrl();

/**
 * Non-null when the app cannot run. `main.tsx` renders an explanation instead
 * of mounting App. Throwing here would abort module evaluation before React
 * mounts, which shows the user a blank page and puts the only diagnostic in
 * the console — the exact failure mode this replaced.
 */
export const CONFIG_ERROR: string | null = config.error;

export const WEBHOOK_URL: string = config.url;

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
