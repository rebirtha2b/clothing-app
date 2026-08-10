import { useMemo } from "react";

import Header from "./Header";
import { PAYMENT_LINK_URL, PRICE_LABEL } from "../lib/constants";

type Props = {
  userId: string;
  email: string | undefined;
  /** Waiting for a just-completed payment to be confirmed by the webhook. */
  confirming: boolean;
  onRecheck: () => void;
};

/**
 * Shown to a signed-in user who has not bought access.
 *
 * client_reference_id is the whole trick: Stripe echoes it into the checkout
 * session and then into the webhook, which is how an otherwise anonymous
 * payment is tied back to this account. Matching on email instead would be
 * unreliable — the buyer can type a different address on Stripe's page.
 */
export default function Paywall({ userId, email, confirming, onRecheck }: Props) {
  const checkoutUrl = useMemo(() => {
    if (!PAYMENT_LINK_URL) return "";

    const url = new URL(PAYMENT_LINK_URL);
    url.searchParams.set("client_reference_id", userId);
    if (email) url.searchParams.set("prefilled_email", email);
    return url.toString();
  }, [userId, email]);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-6xl px-6 pt-10 pb-24">
        <nav className="flex items-center gap-2 text-xs">
          <span>Home</span>
          <span className="text-muted">›</span>
          <span>Studio</span>
          <span className="text-muted">›</span>
          <span className="text-muted">Access</span>
        </nav>

        <h1 className="mt-8 text-5xl font-light tracking-tight sm:text-6xl">
          Unlock the studio
        </h1>

        <p className="mt-4 max-w-md text-sm text-muted">
          One payment, permanent access. No subscription and nothing to cancel.
        </p>

        <div className="mt-12 max-w-xl rounded-xl bg-card p-8 sm:p-10">
          <p className="text-[11px] tracking-[0.24em] text-muted uppercase">
            Image Merge Studio
          </p>

          <p className="mt-6 text-5xl font-light tracking-tight">
            {PRICE_LABEL}
          </p>
          <p className="mt-2 text-sm text-muted">One-time payment</p>

          <ul className="mt-8 flex flex-col gap-3 border-t border-hairline pt-8 text-sm text-muted">
            <li>Unlimited merges from your source and garment images</li>
            <li>Full-resolution downloads</li>
            <li>Access tied to this account</li>
          </ul>

          <div className="mt-10 flex justify-center">
            {confirming ? (
              <p className="text-[11px] tracking-[0.18em] text-muted uppercase">
                Confirming your payment…
              </p>
            ) : (
              <a
                href={checkoutUrl}
                className="cursor-pointer bg-ink px-10 py-4 text-[11px] tracking-[0.24em] text-white uppercase transition-opacity hover:opacity-85"
              >
                Continue to payment
              </a>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            Payment is handled by Stripe. We never see your card details.
          </p>
        </div>

        <div className="mt-10 border-t border-hairline pt-6">
          <button
            type="button"
            onClick={onRecheck}
            disabled={confirming}
            className="cursor-pointer text-[11px] tracking-[0.18em] text-muted uppercase transition-colors hover:text-ink disabled:cursor-not-allowed"
          >
            Already paid? Check again
          </button>
        </div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl justify-center px-6 py-8">
          <span className="text-[11px] tracking-[0.18em] text-muted uppercase">
            Atelier — Studio Tools
          </span>
        </div>
      </footer>
    </div>
  );
}
