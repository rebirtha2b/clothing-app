import type { AuthError } from "@supabase/supabase-js";

import { GENERIC_ERROR } from "./constants";

/**
 * Turns a Supabase AuthError into copy we are willing to show. Raw messages
 * from the auth server are terse, change between releases, and occasionally
 * leak internals ("Database error saving new user"), so nothing reaches the
 * screen unless it is listed here.
 */
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password do not match.";
    case "email_not_confirmed":
      return "Confirm your email address before signing in.";
    case "user_already_exists":
    case "email_exists":
      return "An account already exists for that email. Sign in instead.";
    case "weak_password":
      return "Choose a stronger password.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a moment and try again.";
    case "validation_failed":
      return "Check the details you entered.";
    default:
      // 0 means the request never reached the server — fetch itself failed.
      return error.status === 0
        ? "Could not reach the server. Check your connection."
        : GENERIC_ERROR;
  }
}
