"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function SandboxPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "redirecting" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    async function signIn() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.signInWithPassword({
        email: "demo@nexpura.com",
        password: "nexpura-demo-2026",
      });

      if (error) {
        setErrorMsg(error.message);
        setStatus("error");
        return;
      }

      setStatus("redirecting");
      setTimeout(() => {
        router.push("/");
      }, 800);
    }

    signIn();
  }, [router]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-10 max-w-md w-full text-center">
        {/* Logo / brand mark */}
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">💎</span>
        </div>

        <h1 className="text-2xl font-semibold text-stone-800 mb-2">Demo Sandbox</h1>
        <p className="text-stone-500 text-sm mb-8">Entering Marcus &amp; Co. Fine Jewellery...</p>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-stone-400 text-sm">Signing in to demo account...</p>
          </div>
        )}

        {status === "redirecting" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-green-600 text-sm font-medium">Redirecting to app...</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-500 text-lg">✕</span>
            </div>
            <div>
              <p className="text-red-600 text-sm font-medium">Sign-in failed</p>
              <p className="text-stone-400 text-xs mt-1">{errorMsg}</p>
            </div>
            <button
              onClick={() => {
                setStatus("loading");
                setErrorMsg("");
                window.location.reload();
              }}
              className="text-amber-600 text-sm underline hover:text-amber-700"
            >
              Try again
            </button>
          </div>
        )}

        <p className="text-stone-300 text-xs mt-10">
          Isolated to seeded demo tenant only. No production data.
        </p>
      </div>
    </div>
  );
}
