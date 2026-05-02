"use client";

import { ExternalLink } from "lucide-react";
import type { WebsiteConfig } from "../types";

interface DomainTabProps {
  config: WebsiteConfig;
  customDomainInput: string;
  setCustomDomainInput: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}

export default function DomainTab({
  config,
  customDomainInput,
  setCustomDomainInput,
  onSave,
  saving,
}: DomainTabProps) {
  return (
    <div className="space-y-6">
      {/* Nexpura URL chip */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-stone-900">Your Nexpura URL</h2>
        {config.subdomain ? (
          <a
            href={`https://${config.subdomain}.nexpura.com`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-800 rounded-lg text-sm font-mono hover:bg-stone-200 transition-colors"
          >
            {config.subdomain}.nexpura.com
            <ExternalLink size={13} className="text-stone-500" />
          </a>
        ) : (
          <p className="text-sm text-stone-500">
            Set a subdomain in the Setup tab first.
          </p>
        )}
      </div>

      {/* Custom domain */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-stone-900">
          Connect Your Own Domain{" "}
          <span className="text-xs font-normal text-stone-400 ml-1">(optional)</span>
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={customDomainInput}
            onChange={(e) => setCustomDomainInput(e.target.value)}
            placeholder="yourdomain.com.au"
            className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30 focus:border-nexpura-bronze"
          />
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {customDomainInput && (
          <div className="space-y-4 mt-2">
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
              <p className="text-sm font-medium text-stone-700 mb-3">
                Point your domain to Nexpura by adding this CNAME record:
              </p>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {[
                    ["Type", "CNAME"],
                    ["Name", "@ (or www)"],
                    ["Value", "cname.vercel-dns.com"],
                    ["TTL", "3600"],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b border-stone-200 last:border-0">
                      <td className="py-2 pr-4 font-medium text-stone-600 w-28">{label}</td>
                      <td className="py-2 font-mono text-stone-800">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-stone-500">
              Changes can take up to 24–48 hours to propagate.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-stone-500 self-center">Common registrars:</span>
              {[
                {
                  label: "GoDaddy guide ↗",
                  href: "https://au.godaddy.com/help/add-a-cname-record-19236",
                },
                {
                  label: "Namecheap guide ↗",
                  href: "https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/",
                },
                {
                  label: "Cloudflare guide ↗",
                  href: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
                },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-amber-700 hover:underline"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
