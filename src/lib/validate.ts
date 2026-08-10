import { ACCEPTED_TYPES, MAX_BYTES } from "./constants";

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns a human-readable reason the file is unusable, or null if it passes.
 * Both the file picker and the drop handler run this, so drag-and-drop cannot
 * sidestep the accept attribute.
 */
export function validateFile(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Use a JPG, PNG or WEBP image.";
  }
  if (file.size > MAX_BYTES) {
    return `Image is ${formatMb(file.size)}. Limit is ${formatMb(MAX_BYTES)}.`;
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}

export const MIN_PASSWORD_LENGTH = 8;

/** Deliberately loose: the auth server is the authority on deliverable addresses. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthFieldErrors = {
  name?: string;
  email?: string;
  password?: string;
};

/**
 * Per-field reasons the credentials cannot be submitted, or an empty object if
 * they pass. `name` is only checked on sign-up — sign-in has no name field.
 */
export function validateCredentials(
  fields: { name?: string; email: string; password: string },
  mode: "signin" | "signup",
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  if (mode === "signup" && !fields.name?.trim()) {
    errors.name = "Enter your name.";
  }
  if (!fields.email.trim()) {
    errors.email = "Enter your email.";
  } else if (!EMAIL_SHAPE.test(fields.email.trim())) {
    errors.email = "That does not look like an email address.";
  }
  if (!fields.password) {
    errors.password = "Enter your password.";
  } else if (mode === "signup" && fields.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return errors;
}
