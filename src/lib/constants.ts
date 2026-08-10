/**
 * Vite inlines VITE_* variables into the client bundle at build time, so every
 * value here is readable by anyone on the deployed site. They live in .env for
 * configuration hygiene (per-environment, out of source control), not because
 * that makes them private. Never put a real secret behind a VITE_ prefix.
 *
 * The Supabase publishable key is an exception only in that it is *designed*
 * to ship to browsers — row level security, not obscurity, protects the data.
 */
function readHttpsUrl(
  name: string,
  raw: string | undefined,
): { url: string; error: string | null } {
  if (!raw) return { url: "", error: `${name} is not set.` };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { url: "", error: `${name} is not a valid URL.` };
  }
  if (parsed.protocol !== "https:") {
    return { url: "", error: `${name} must use https.` };
  }

  return { url: raw, error: null };
}

const webhook = readHttpsUrl("VITE_WEBHOOK_URL", import.meta.env.VITE_WEBHOOK_URL);
const supabaseUrl = readHttpsUrl(
  "VITE_SUPABASE_URL",
  import.meta.env.VITE_SUPABASE_URL,
);
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Non-null when the app cannot run. `main.tsx` renders an explanation instead
 * of mounting App. Throwing here would abort module evaluation before React
 * mounts, which shows the user a blank page and puts the only diagnostic in
 * the console — the exact failure mode this replaced.
 *
 * First problem wins; the screen names one variable at a time.
 */
export const CONFIG_ERROR: string | null =
  webhook.error ??
  supabaseUrl.error ??
  (supabaseKey ? null : "VITE_SUPABASE_PUBLISHABLE_KEY is not set.");

export const WEBHOOK_URL: string = webhook.url;

export const SUPABASE_URL: string = supabaseUrl.url;

export const SUPABASE_PUBLISHABLE_KEY: string = supabaseKey;

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
