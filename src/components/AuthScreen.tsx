import { useState } from "react";

import TextField from "./TextField";
import { useAuth } from "../hooks/useAuth";
import { validateCredentials } from "../lib/validate";
import type { AuthFieldErrors } from "../lib/validate";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Address we told to check its inbox; non-null replaces the form. */
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(
    null,
  );

  function switchMode(next: Mode) {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    // The disabled attribute already blocks this; the guard covers the Enter
    // key racing an in-flight request.
    if (busy) return;

    const problems = validateCredentials({ name, email, password }, mode);
    setFieldErrors(problems);
    setFormError(null);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    if (mode === "signup") {
      const result = await signUp(name, email, password);
      setBusy(false);
      if (result.error) setFormError(result.error);
      // Confirmation pending: no session is coming, so say so rather than
      // leaving the form looking like nothing happened.
      else if (result.needsConfirmation) setAwaitingConfirmation(email.trim());
    } else {
      const message = await signIn(email, password);
      setBusy(false);
      if (message) setFormError(message);
    }
    // On a signed-in success the auth listener swaps this screen out.
  }

  const isSignUp = mode === "signup";

  if (awaitingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <p className="text-[11px] tracking-[0.24em] text-muted uppercase">
            Atelier — Studio Tools
          </p>

          <h1 className="mt-4 text-3xl font-light tracking-tight">
            Check your inbox
          </h1>

          <p className="mt-6 text-sm text-muted">
            We sent a confirmation link to{" "}
            <span className="text-ink">{awaitingConfirmation}</span>. Open it to
            activate the account — you will be signed in automatically.
          </p>

          <div className="mt-8 border-t border-hairline pt-6">
            <p className="text-sm text-muted">
              Nothing arrived? Check spam, and confirm the address was typed
              correctly. If an account already exists for it, sign in instead.
            </p>

            <button
              type="button"
              onClick={() => {
                setAwaitingConfirmation(null);
                setPassword("");
                switchMode("signin");
              }}
              className="mt-6 cursor-pointer text-[11px] tracking-[0.18em] text-muted uppercase transition-colors hover:text-ink"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="text-[11px] tracking-[0.24em] text-muted uppercase">
          Atelier — Studio Tools
        </p>

        <h1 className="mt-4 text-3xl font-light tracking-tight">
          {isSignUp ? "Create an account" : "Sign in"}
        </h1>

        <p className="mt-3 text-sm text-muted">
          {isSignUp
            ? "Your name and email identify the account. Nothing is shared."
            : "Sign in to use the image merge studio."}
        </p>

        {/* noValidate: the browser's own bubble preempts onSubmit, is styled by
            the OS, and speaks the browser's language rather than the app's.
            validateCredentials stays the single authority. */}
        <form
          onSubmit={onSubmit}
          noValidate
          className="mt-10 flex flex-col gap-6"
        >
          {isSignUp && (
            <TextField
              label="Name"
              type="text"
              value={name}
              onChange={setName}
              autoComplete="name"
              disabled={busy}
              error={fieldErrors.name}
            />
          )}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            disabled={busy}
            error={fieldErrors.email}
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            disabled={busy}
            error={fieldErrors.password}
          />

          {formError && (
            <p role="alert" className="text-xs text-accent">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 cursor-pointer self-center bg-ink px-10 py-4 text-[11px] tracking-[0.24em] text-white uppercase transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:bg-hairline disabled:text-muted disabled:opacity-100"
          >
            {busy
              ? isSignUp
                ? "Creating account…"
                : "Signing in…"
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <div className="mt-8 border-t border-hairline pt-6">
          <button
            type="button"
            onClick={() => switchMode(isSignUp ? "signin" : "signup")}
            disabled={busy}
            className="cursor-pointer text-[11px] tracking-[0.18em] text-muted uppercase transition-colors hover:text-ink disabled:cursor-not-allowed"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "No account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
