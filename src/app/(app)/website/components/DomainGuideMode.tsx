"use client";

import type { WebsiteType } from "../types";
import { DOMAIN_REGISTRARS } from "./constants";

interface DomainGuideModeProps {
  onTypeChange: (type: WebsiteType) => void;
}

export default function DomainGuideMode({ onTypeChange }: DomainGuideModeProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-stone-900">Get Your Own Domain</h2>
        <p className="text-sm text-stone-600">
          A domain (like <span className="font-mono">myjewellery.com.au</span>) is your unique
          address on the internet. Once you have one, you can:
        </p>
        <ul className="space-y-1">
          <li className="text-sm text-stone-600 flex gap-2">
            <span className="text-amber-700">•</span> Point it to your Nexpura hosted site
          </li>
          <li className="text-sm text-stone-600 flex gap-2">
            <span className="text-amber-700">•</span> Or connect it to your existing website
          </li>
        </ul>
      </div>

      {/* Step 1 */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-nexpura-charcoal text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
            1
          </span>
          <h2 className="text-base font-semibold text-stone-900">
            Choose and buy a domain
          </h2>
        </div>
        <p className="text-sm text-stone-500">
          We recommend <strong>.com.au</strong> for Australian jewellers. Popular registrars:
        </p>
        <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl overflow-hidden">
          {DOMAIN_REGISTRARS.map((r) => (
            <div key={r.name} className="flex items-center justify-between p-4">
              <div className="flex gap-3 items-start">
                <span className="text-xl">{r.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900 text-sm">{r.name}</span>
                    <span className="text-xs text-stone-400">{r.price}</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">{r.desc}</p>
                </div>
              </div>
              <a
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="flex-shrink-0 ml-4 px-3 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors"
              >
                Visit {r.name} ↗
              </a>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Tips for choosing
          </p>
          {[
            "For Australia: .com.au (most trusted), .au (newer), .com (global)",
            "Keep it short, memorable, easy to spell",
            "Use your business name if available",
          ].map((tip) => (
            <p key={tip} className="text-sm text-stone-600 flex gap-2">
              <span className="text-amber-700">•</span> {tip}
            </p>
          ))}
        </div>
      </div>

      {/* Step 2 */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-stone-300 text-stone-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
            2
          </span>
          <h2 className="text-base font-semibold text-stone-900">Come back and connect</h2>
        </div>
        <p className="text-sm text-stone-600">
          Once you have your domain, come back here and:
        </p>
        <ol className="space-y-1.5">
          {[
            'Switch to "Nexpura Hosted" to build your site',
            "Go to the Domain tab and enter your domain",
            "Follow the CNAME instructions to point it here",
          ].map((step, i) => (
            <li key={i} className="flex gap-2 text-sm text-stone-600">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-stone-100 text-stone-500 text-xs font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="text-sm text-stone-500 italic">
          OR switch to "Connect My Site" if you're building on Squarespace, Wix, etc.
        </p>
      </div>

      {/* Switch buttons */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={() => onTypeChange("connect")}
          className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
        >
          Already have a domain? Switch to Connect My Site →
        </button>
        <button
          onClick={() => onTypeChange("hosted")}
          className="px-4 py-2 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors"
        >
          Switch to Nexpura Hosted →
        </button>
      </div>
    </div>
  );
}
