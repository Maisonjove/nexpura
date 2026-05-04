"use client";

import { useState } from "react";
import {
  CreditCardIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  LinkSlashIcon,
} from "@heroicons/react/24/outline";

interface PaymentsClientProps {
  tenantId: string;
  stripeAccountId?: string | null;
  businessName?: string | null;
}

export default function PaymentsClient({
  tenantId,
  stripeAccountId,
  businessName,
}: PaymentsClientProps) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = !!stripeAccountId;

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/connect/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // Redirect to Stripe onboarding
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Stripe? You won't be able to accept card payments until you reconnect.")) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/connect/disconnect", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Disconnect failed");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
      setDisconnecting(false);
    }
  };

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-14">
          <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
            Settings
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-[1.08] tracking-tight">
            Payments
          </h1>
          <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
            Connect a payment processor to accept card payments in POS, send payment links, and process invoices.
          </p>
        </div>

        <div className="space-y-8 lg:space-y-12">
          {/* Connection Status */}
          <section className="group bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                Step 01
              </p>
              <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                Stripe Account
              </h2>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                Stripe powers card processing on Nexpura. Connect once and you can accept cards, Apple Pay, Google Pay, and payment links.
              </p>
            </div>

            <div className="border-t border-stone-200 pt-6">
              <div className="flex items-start gap-5">
                <CreditCardIcon className="w-5 h-5 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300 shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-serif text-xl text-stone-900 leading-tight">Stripe</h3>
                    {isConnected && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nexpura-bronze/10 text-nexpura-bronze text-[11px] font-medium tracking-wide rounded-full">
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                    {isConnected
                      ? "Your Stripe account is connected. You can accept card payments in POS and send payment links."
                      : "Connect Stripe to accept credit cards, Apple Pay, Google Pay, and more."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                Step 02
              </p>
              <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                {isConnected ? "Manage Connection" : "Connect Stripe"}
              </h2>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                {isConnected
                  ? "Open your Stripe dashboard to manage payouts, refunds, and disputes — or disconnect this account."
                  : "You'll be redirected to Stripe to complete setup. Takes about five minutes."}
              </p>
            </div>

            <div className="border-t border-stone-200 pt-6">
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="nx-btn-primary inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {connecting ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    <>
                      <CreditCardIcon className="w-4 h-4" />
                      Connect with Stripe
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition-colors duration-200"
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    Open Stripe Dashboard
                  </a>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-red-600 hover:bg-red-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition-colors duration-200 disabled:opacity-50"
                  >
                    {disconnecting ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Disconnecting…
                      </>
                    ) : (
                      <>
                        <LinkSlashIcon className="w-4 h-4" />
                        Disconnect
                      </>
                    )}
                  </button>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mt-5 border-l-2 border-red-400 pl-4 py-1 text-sm text-red-600 leading-relaxed flex items-start gap-2"
                >
                  <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </section>

          {/* Capabilities */}
          <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                What's Included
              </p>
              <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                Capabilities
              </h2>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                Everything you can do once Stripe is connected to your Nexpura account.
              </p>
            </div>

            <div className="border-t border-stone-200 pt-6">
              <ul className="space-y-5">
                <li className="flex items-start gap-4">
                  <CheckCircleIcon className="w-4 h-4 text-nexpura-bronze mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-stone-900 tracking-tight">Accept cards</p>
                    <p className="text-sm text-stone-500 mt-0.5 leading-relaxed">Visa, Mastercard, Amex, and more.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircleIcon className="w-4 h-4 text-nexpura-bronze mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-stone-900 tracking-tight">Apple Pay & Google Pay</p>
                    <p className="text-sm text-stone-500 mt-0.5 leading-relaxed">One-tap payments on supported devices.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircleIcon className="w-4 h-4 text-nexpura-bronze mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-stone-900 tracking-tight">Payment links</p>
                    <p className="text-sm text-stone-500 mt-0.5 leading-relaxed">Send invoices with pay buttons clients can tap.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircleIcon className="w-4 h-4 text-nexpura-bronze mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-stone-900 tracking-tight">Automatic deposits</p>
                    <p className="text-sm text-stone-500 mt-0.5 leading-relaxed">Funds land directly in your bank account.</p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* Fees Note */}
          <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                Fees
              </p>
              <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                Processing Costs
              </h2>
            </div>
            <div className="border-t border-stone-200 pt-6">
              <p className="text-sm text-stone-600 leading-relaxed">
                Stripe charges standard rates — typically 2.9% plus 30¢ per transaction. Nexpura adds no additional fees on payments. Volume discounts and custom rates are available directly through Stripe once your account is established.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
