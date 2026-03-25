import Link from "next/link";

export const metadata = { title: "Settings — Nexpura Admin" };

export default function AdminSettingsPage() {
    return (
          <div className="max-w-3xl mx-auto py-10 px-4">
            {/* Header */}
                <div className="mb-8">
                        <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 mb-1 inline-block">← Admin</Link>Link>
                        <h1 className="text-2xl font-semibold text-stone-900">Settings</h1>h1>
                        <p className="text-sm text-stone-500 mt-0.5">Platform configuration and admin preferences</p>p>
                </div>div>
          
            {/* Sections */}
                <div className="space-y-6">
                
                  {/* General */}
                        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                                  <div className="px-5 py-4 border-b border-stone-100">
                                              <h2 className="text-sm font-semibold text-stone-700">General</h2>h2>
                                  </div>div>
                                  <div className="divide-y divide-stone-100">
                                              <div className="px-5 py-4 flex items-center justify-between">
                                                            <div>
                                                                            <p className="text-sm font-medium text-stone-900">Platform name</p>p>
                                                                            <p className="text-xs text-stone-500 mt-0.5">Displayed in emails and the admin panel</p>p>
                                                            </div>div>
                                                            <span className="text-sm text-stone-600">Nexpura</span>span>
                                              </div>div>
                                              <div className="px-5 py-4 flex items-center justify-between">
                                                            <div>
                                                                            <p className="text-sm font-medium text-stone-900">Environment</p>p>
                                                                            <p className="text-xs text-stone-500 mt-0.5">Current deployment environment</p>p>
                                                            </div>div>
                                                            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">Production</span>span>
                                              </div>div>
                                  </div>div>
                        </div>div>
                
                  {/* Admin Access */}
                        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                                  <div className="px-5 py-4 border-b border-stone-100">
                                              <h2 className="text-sm font-semibold text-stone-700">Admin Access</h2>h2>
                                  </div>div>
                                  <div className="divide-y divide-stone-100">
                                              <div className="px-5 py-4 flex items-center justify-between">
                                                            <div>
                                                                            <p className="text-sm font-medium text-stone-900">Super admin access</p>p>
                                                                            <p className="text-xs text-stone-500 mt-0.5">Managed via the super_admins table in Supabase</p>p>
                                                            </div>div>
                                                            <Link
                                                                              href="https://supabase.com/dashboard"
                                                                              target="_blank"
                                                                              className="text-xs text-amber-700 hover:text-amber-800 font-medium"
                                                                            >
                                                                            Open Supabase →
                                                            </Link>Link>
                                              </div>div>
                                  </div>div>
                        </div>div>
                
                  {/* Billing */}
                        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                                  <div className="px-5 py-4 border-b border-stone-100">
                                              <h2 className="text-sm font-semibold text-stone-700">Billing & Plans</h2>h2>
                                  </div>div>
                                  <div className="divide-y divide-stone-100">
                                              <div className="px-5 py-4 flex items-center justify-between">
                                                            <div>
                                                                            <p className="text-sm font-medium text-stone-900">Boutique plan</p>p>
                                                                            <p className="text-xs text-stone-500 mt-0.5">Single-location salon</p>p>
                                                            </div>div>
                                                            <span className="text-sm font-medium text-stone-900">$89 / mo</span>span>
                                              </div>div>
                                              <div className="px-5 py-4 flex items-center justify-between">
                                                            <div>
                                                                            <p className="text-sm font-medium text-stone-900">Studio plan</p>p>
                                                                            <p className="text-xs text-stone-500 mt-0.5">Multi-location / premium features</p>p>
                                                            </div>div>
                                                            <span className="text-sm font-medium text-stone-900">$179 / mo</span>span>
                                              </div>div>
                                              <div className="px-5 py-4 flex items-center justify-between">
                                                            <div>
                                                                            <p className="text-sm font-medium text-stone-900">Group plan</p>p>
                                                                            <p className="text-xs text-stone-500 mt-0.5">Enterprise / custom pricing</p>p>
                                                            </div>div>
                                                            <span className="text-sm font-medium text-stone-900">Custom</span>span>
                                              </div>div>
                                  </div>div>
                        </div>div>
                
                  {/* Quick links */}
                        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                                  <div className="px-5 py-4 border-b border-stone-100">
                                              <h2 className="text-sm font-semibold text-stone-700">Quick Links</h2>h2>
                                  </div>div>
                                  <div className="divide-y divide-stone-100">
                                    {[
            { label: "Vercel deployments", href: "https://vercel.com/dashboard", desc: "View build logs and deployments" },
            { label: "Supabase dashboard", href: "https://supabase.com/dashboard", desc: "Database, auth, and storage" },
            { label: "Revenue overview", href: "/admin/revenue", desc: "MRR, ARR, and subscription metrics" },
            { label: "Tenant management", href: "/admin/tenants", desc: "View and manage all tenants" },
                        ].map((link) => (
                                        <div key={link.href} className="px-5 py-4 flex items-center justify-between">
                                                        <div>
                                                                          <p className="text-sm font-medium text-stone-900">{link.label}</p>p>
                                                                          <p className="text-xs text-stone-500 mt-0.5">{link.desc}</p>p>
                                                        </div>div>
                                                        <Link
                                                                            href={link.href}
                                                                            target={link.href.startsWith("http") ? "_blank" : undefined}
                                                                            className="text-xs text-amber-700 hover:text-amber-800 font-medium"
                                                                          >
                                                                          Open →
                                                        </Link>Link>
                                        </div>div>
                                      ))}
                                  </div>div>
                        </div>div>
                
                </div>div>
          </div>div>
        );
}</div>
