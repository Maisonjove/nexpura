"use client";

import { useState } from "react";
import { 
  CreditCard, 
  CheckCircle2, 
  ExternalLink,
  Loader2,
  AlertTriangle,
  Unlink
} from "lucide-react";

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
    <div className="space-y-6">
      {/* Status Card */}
      <div className={`rounded-xl border p-6 ${
        isConnected 
          ? "bg-green-50/50 border-green-200" 
          : "bg-white border-stone-200"
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isConnected ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
          }`}>
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-stone-900">Stripe</h3>
              {isConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </span>
              )}
            </div>
            
            {isConnected ? (
              <p className="text-sm text-stone-600 mt-1">
                Your Stripe account is connected. You can accept card payments in POS and send payment links.
              </p>
            ) : (
              <p className="text-sm text-stone-500 mt-1">
                Connect Stripe to accept credit cards, Apple Pay, Google Pay, and more.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        {!isConnected ? (
          <div className="space-y-4">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#635BFF] text-white font-medium rounded-lg hover:bg-[#5851E6] transition-colors disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Connect with Stripe
                </>
              )}
            </button>
            
            <p className="text-xs text-stone-400 text-center">
              You'll be redirected to Stripe to complete setup. Takes about 5 minutes.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-stone-100 text-stone-700 font-medium rounded-lg hover:bg-stone-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Stripe Dashboard
            </a>
            
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <Unlink className="w-4 h-4" />
                  Disconnect Stripe
                </>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Features */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h4 className="font-medium text-stone-900 mb-4">What you can do with Stripe:</h4>
        <ul className="space-y-3 text-sm text-stone-600">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span><strong>Accept cards</strong> — Visa, Mastercard, Amex, and more</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span><strong>Apple Pay & Google Pay</strong> — One-tap payments</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span><strong>Payment links</strong> — Send invoices with pay buttons</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span><strong>Automatic deposits</strong> — Money lands in your bank</span>
          </li>
        </ul>
      </div>

      {/* Fees Note */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 text-sm text-stone-600">
        <p>
          <strong>Processing fees:</strong> Stripe charges standard rates (typically 2.9% + 30¢ per transaction). 
          Nexpura doesn't add any additional fees on payments.
        </p>
      </div>
    </div>
  );
}
