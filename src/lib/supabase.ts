import { createClient } from "@supabase/supabase-js";

import { CONFIG_ERROR, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./constants";

/**
 * createClient throws on an empty URL or key, and this module is imported
 * eagerly through AuthProvider — a throw here would blank the page instead of
 * letting main.tsx render the ConfigError screen. When config is missing we
 * build a client against an unreachable placeholder that is never used,
 * because ConfigError renders in place of the whole app.
 */
const url = CONFIG_ERROR ? "https://placeholder.invalid" : SUPABASE_URL;
const key = CONFIG_ERROR ? "placeholder" : SUPABASE_PUBLISHABLE_KEY;

/**
 * The only place a Supabase client is constructed.
 *
 * detectSessionInUrl is on even though email confirmation is currently off: it
 * costs one URL check per load, and it is what would turn a confirmation
 * link's fragment tokens into a session if confirmation is ever switched back
 * on. Leaving it enabled keeps that a dashboard toggle rather than a code
 * change. See the auth section of CLAUDE.md before flipping it.
 */
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
