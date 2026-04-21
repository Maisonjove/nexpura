"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Gem, LogOut } from "lucide-react";

function LogoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  useEffect(() => {
    async function logout() {
      const supabase = createClient();
      await supabase.auth.signOut();
      // PR-05: actively clear the HttpOnly 2FA proof cookie that Supabase
      // signOut cannot touch. Best-effort — even if this fails the cookie
      // is bound to the old user id and will fail verification on next use.
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        });
      } catch {
        // Non-blocking; cookie is user-ID-bound so orphan can't grant AAL2.
      }
      // Clear session timeout tracking
      localStorage.removeItem("nexpura_last_activity");
      // Redirect to login after a brief delay
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    }
    logout();
  }, [router]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-amber-700 flex items-center justify-center">
            <Gem size={18} color="white" />
          </div>
          <span className="text-xl font-semibold text-stone-900">Nexpura</span>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-8 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <LogOut className="w-6 h-6 text-amber-700" />
          </div>

          <h1 className="text-xl font-semibold text-stone-900 mb-2">
            Signing out...
          </h1>

          {reason === "timeout" && (
            <p className="text-stone-500 text-sm mb-4">
              Your session has expired due to inactivity.
            </p>
          )}

          <p className="text-stone-400 text-sm">
            You will be redirected to the login page shortly.
          </p>

          {/* Loading spinner */}
          <div className="mt-6">
            <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
          <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LogoutContent />
    </Suspense>
  );
}
