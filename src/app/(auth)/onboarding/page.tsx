"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Plan = "basic" | "pro" | "ultimate";

const BUSINESS_TYPES = [
  "Independent Jeweller",
  "Jewellery Retailer",
  "Bespoke Studio",
  "Repair Workshop",
  "Wholesale / Trade",
  "Other",
];

const PLANS: { id: Plan; name: string; price: string; features: string[]; badge?: string }[] = [
  {
    id: "basic",
    name: "Basic",
    price: "£29/mo",
    features: ["Up to 2 staff", "Customers & jobs", "Invoicing", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "£69/mo",
    features: ["Up to 10 staff", "Everything in Basic", "Repairs & stock", "Custom reports", "Priority support"],
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: "£149/mo",
    features: ["Unlimited staff", "Everything in Pro", "AI assistant", "Multi-location", "Dedicated support"],
    badge: "Best value",
  },
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");

  // Step 2
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState("#52B788");

  // Step 3
  const [plan, setPlan] = useState<Plan>("pro");

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleComplete() {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      const slug = slugify(businessName) + "-" + Math.random().toString(36).slice(2, 7);

      // 1. Create tenant
      const { data: tenant, error: tenantErr } = await supabase
        .from("tenants")
        .insert({
          name: businessName,
          slug,
          business_type: businessType,
          brand_color: brandColor,
        })
        .select()
        .single();

      if (tenantErr) throw tenantErr;

      // 2. Upload logo if provided
      let logoUrl: string | null = null;
      if (logoFile && tenant) {
        const ext = logoFile.name.split(".").pop();
        const path = `${tenant.id}/logo.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("tenant-logos")
          .upload(path, logoFile, { upsert: true });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("tenant-logos").getPublicUrl(path);
          logoUrl = urlData.publicUrl;

          await supabase.from("tenants").update({ logo_url: logoUrl }).eq("id", tenant.id);
        }
      }

      // 3. Create user record
      const { error: userErr } = await supabase.from("users").insert({
        id: user.id,
        tenant_id: tenant.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email,
        role: "owner",
      });

      if (userErr) throw userErr;

      // 4. Create subscription (14-day trial)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const { error: subErr } = await supabase.from("subscriptions").insert({
        tenant_id: tenant.id,
        plan,
        status: "trialing",
        trial_ends_at: trialEndsAt.toISOString(),
      });

      if (subErr) throw subErr;

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="font-fraunces text-3xl font-semibold text-forest">Nexpura</h1>
        <p className="text-sm text-forest/60 mt-1">Let&apos;s set up your workspace</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                s < step
                  ? "bg-sage text-white"
                  : s === step
                  ? "bg-forest text-white"
                  : "bg-platinum text-forest/40"
              }`}
            >
              {s < step ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s
              )}
            </div>
            {s < 3 && (
              <div className={`flex-1 h-0.5 mx-2 ${s < step ? "bg-sage" : "bg-platinum"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-platinum p-8">
        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h2 className="font-fraunces text-xl font-semibold text-forest mb-1">
              Your business
            </h2>
            <p className="text-sm text-forest/60 mb-6">Tell us about your jewellery business.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-forest mb-1">
                  Business name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Smith & Sons Jewellers"
                  className="w-full px-3 py-2.5 rounded-lg border border-platinum bg-ivory text-forest placeholder-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-forest mb-1">
                  Business type
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-platinum bg-ivory text-forest focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage transition-colors text-sm"
                >
                  <option value="">Select a type…</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                if (!businessName.trim()) return;
                setStep(2);
              }}
              disabled={!businessName.trim()}
              className="w-full mt-6 bg-sage hover:bg-sage/90 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <h2 className="font-fraunces text-xl font-semibold text-forest mb-1">
              Brand identity
            </h2>
            <p className="text-sm text-forest/60 mb-6">Optional — you can change this anytime.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-forest mb-2">
                  Business logo
                </label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-platinum rounded-lg cursor-pointer hover:border-sage transition-colors bg-ivory">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Logo preview" className="h-24 object-contain" />
                  ) : (
                    <div className="text-center">
                      <svg className="w-8 h-8 text-forest/30 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-forest/50">Click to upload logo</p>
                      <p className="text-xs text-forest/30">PNG, JPG, SVG up to 2MB</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-forest mb-2">
                  Brand colour
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border border-platinum cursor-pointer"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    placeholder="#52B788"
                    className="flex-1 px-3 py-2.5 rounded-lg border border-platinum bg-ivory text-forest text-sm focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-platinum text-forest/70 font-medium py-2.5 rounded-lg hover:bg-ivory transition-colors text-sm"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-sage hover:bg-sage/90 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h2 className="font-fraunces text-xl font-semibold text-forest mb-1">
              Choose your plan
            </h2>
            <p className="text-sm text-forest/60 mb-6">
              Start free for 14 days — no card required.
            </p>

            <div className="space-y-3 mb-6">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    plan === p.id
                      ? "border-sage bg-sage/5"
                      : "border-platinum hover:border-sage/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-forest text-sm">{p.name}</span>
                      {p.badge && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gold/20 text-gold">
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-forest">{p.price}</span>
                      <div
                        className={`w-4 h-4 rounded-full border-2 transition-all ${
                          plan === p.id ? "border-sage bg-sage" : "border-platinum"
                        }`}
                      />
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {p.features.map((f) => (
                      <li key={f} className="text-xs text-forest/60 flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-sage flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-platinum text-forest/70 font-medium py-2.5 rounded-lg hover:bg-ivory transition-colors text-sm"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 bg-sage hover:bg-sage/90 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
              >
                {loading ? "Setting up…" : "Start free trial"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
