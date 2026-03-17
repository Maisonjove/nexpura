"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface Props {
  token: string;
  invite: {
    id: string;
    name: string;
    email: string;
    role: string;
    businessName: string;
  };
}

export default function InviteClient({ token, invite }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      // Create the user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            full_name: invite.name,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          setError("An account with this email already exists. Please log in instead.");
        } else {
          setError(signUpError.message);
        }
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Failed to create account");
        setIsLoading(false);
        return;
      }

      // Accept the invite via API
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, userId: authData.user.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to accept invitation");
        setIsLoading(false);
        return;
      }

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-stone-600 to-stone-700 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">N</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Join {invite.businessName}</h1>
          <p className="text-stone-500 text-sm">
            You&apos;ve been invited as a <span className="font-medium text-stone-700">{invite.role.replace("_", " ")}</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name (readonly) */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Name</label>
            <input
              type="text"
              value={invite.name}
              disabled
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg bg-stone-50 text-stone-500"
            />
          </div>

          {/* Email (readonly) */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
            <input
              type="email"
              value={invite.email}
              disabled
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg bg-stone-50 text-stone-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Create Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-stone-800 hover:bg-stone-900 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Creating account...
              </>
            ) : (
              "Accept Invitation & Create Account"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-stone-400 mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-amber-600 hover:text-amber-700 font-medium">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
