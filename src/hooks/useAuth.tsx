import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { authErrorMessage } from "../lib/authErrors";
import { supabase } from "../lib/supabase";

export type SignUpResult = {
  error: string | null;
  /**
   * True when the account was created but no session came back — email
   * confirmation is enabled, so the user must click the link first. Also true
   * for an email that already exists: the auth server returns an
   * indistinguishable response on purpose, to avoid confirming to a stranger
   * which addresses are registered.
   */
  needsConfirmation: boolean;
};

type AuthValue = {
  session: Session | null;
  /** Display name from user metadata; empty until a signed-in session exists. */
  displayName: string;
  /** True until the stored session has been read once, so the app never flashes the login screen. */
  loading: boolean;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Fires on sign in, sign out, and token refresh — including from another
    // tab, since the session lives in localStorage.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  /**
   * The three actions return a message to show or null on success. They do not
   * set session state themselves — onAuthStateChange is the single writer.
   */
  const signUp = useCallback(
    async (
      name: string,
      email: string,
      password: string,
    ): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Read by the on_auth_user_created trigger to populate public.profiles.
          data: { name: name.trim() },
          // Where the confirmation link returns to. Must also be listed under
          // Authentication → URL Configuration in the Supabase dashboard, or
          // the link falls back to the project's Site URL.
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) return { error: authErrorMessage(error), needsConfirmation: false };
      return { error: null, needsConfirmation: !data.session };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return error ? authErrorMessage(error) : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const displayName = useMemo(() => {
    const meta = session?.user.user_metadata as { name?: unknown } | undefined;
    const name = typeof meta?.name === "string" ? meta.name.trim() : "";
    return name || session?.user.email || "";
  }, [session]);

  const value = useMemo(
    () => ({ session, displayName, loading, signUp, signIn, signOut }),
    [session, displayName, loading, signUp, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
