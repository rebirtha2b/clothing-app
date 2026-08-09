export const WEBHOOK_URL =
  "https://rebirtha2b.app.n8n.cloud/webhook/a2ac7e1c-64fa-49ec-80ae-a86996d21757";

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

/** What the file picker advertises. Kept in sync with ACCEPTED_TYPES by hand. */
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";

export const MAX_BYTES = 10 * 1024 * 1024;

export const GENERIC_ERROR = "Something went wrong. Please try again.";
