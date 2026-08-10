import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "../lib/supabase";

/**
 * Whether the signed-in user has bought access.
 *
 * Purchases are written server-side by the stripe-webhook function; this only
 * reads, through the select-own RLS policy on public.purchases. It is a
 * convenience for deciding what to render — the `generate` Edge Function does
 * the enforcing, so a user who forces `paid` here still gets a 402.
 *
 * Fulfilment is asynchronous: Stripe redirects the browser back the instant the
 * payment succeeds, which can beat the webhook by a second or two. Landing with
 * ?paid=1 therefore polls rather than concluding "unpaid" from the first read.
 */
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

export type Entitlement = {
  paid: boolean;
  /** True until the first answer for this user. Gates the initial render only. */
  loading: boolean;
  /** True while waiting for a just-completed payment to be confirmed. */
  confirming: boolean;
  refresh: () => void;
};

/** Consumed once on mount: the flag Stripe's redirect appends on return. */
function consumeReturnFlag(): boolean {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  if (!url.searchParams.has("paid")) return false;

  // Strip it so a later reload does not restart the poll.
  url.searchParams.delete("paid");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  return true;
}

export function useEntitlement(userId: string | undefined): Entitlement {
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  // useState initialiser, not an effect: React 19 StrictMode mounts twice in
  // dev, and reading the flag in an effect would consume it on the first pass
  // and see nothing on the second.
  const [returnedFromStripe] = useState(consumeReturnFlag);

  /** Bumped by refresh() to re-run the effect. */
  const [attempt, setAttempt] = useState(0);
  /** While Date.now() is below this, an unpaid answer means "keep waiting". */
  const deadlineRef = useRef(returnedFromStripe ? Date.now() + POLL_TIMEOUT_MS : 0);

  const refresh = useCallback(() => {
    deadlineRef.current = Date.now() + POLL_TIMEOUT_MS;
    setConfirming(true);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (returnedFromStripe) setConfirming(true);
  }, [returnedFromStripe]);

  useEffect(() => {
    if (!userId) {
      setPaid(false);
      setLoading(false);
      setConfirming(false);
      return;
    }

    let active = true;
    let timer: number | undefined;

    async function check() {
      // RLS restricts this to the caller's own rows, so no user filter is
      // needed — and none would be trusted if it were.
      const { data, error } = await supabase
        .from("purchases")
        .select("id")
        .eq("status", "paid")
        .limit(1)
        .maybeSingle();

      if (!active) return;

      // A read failure is not proof of non-payment, so it leaves `paid` alone
      // and lets the poll — or the user's own retry — try again.
      if (!error) setPaid(Boolean(data));
      setLoading(false);

      if (data) {
        setConfirming(false);
        return;
      }
      if (Date.now() < deadlineRef.current) {
        timer = window.setTimeout(check, POLL_INTERVAL_MS);
      } else {
        setConfirming(false);
      }
    }

    void check();

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [userId, attempt]);

  return { paid, loading, confirming, refresh };
}
