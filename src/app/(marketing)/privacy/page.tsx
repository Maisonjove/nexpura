import { NavBar } from "@/components/marketing/NavBar";
import { Footer } from "@/components/marketing/Footer";

export const dynamic = "force-static";

export const metadata = {
  title: "Privacy Policy — Nexpura",
  description: "How Nexpura collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h1 className="text-3xl font-semibold text-stone-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-stone-500 mb-10">Last updated: March 2026</p>

          <div className="prose prose-stone max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">1. Information We Collect</h2>
              <p className="text-stone-600 leading-relaxed">We collect information you provide directly to us, including your name, email address, business details, and payment information when you register for or use Nexpura. We also collect business data you enter into the platform — such as inventory, customer records, repair jobs, and sales transactions — which remains yours at all times.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">2. How We Use Information</h2>
              <p className="text-stone-600 leading-relaxed">We use your information to provide, maintain, and improve the Service; process payments; send transactional and product communications; respond to support requests; and comply with legal obligations. We do not use your business data for any purpose beyond delivering the Service to you.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">3. Data Storage &amp; Security</h2>
              <p className="text-stone-600 leading-relaxed">Your data is stored on Supabase infrastructure hosted in Australia (where available) with industry-standard encryption at rest and in transit. We implement appropriate technical and organisational measures to protect your data against unauthorised access, loss, or disclosure. Regular backups are performed automatically.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">4. Third-Party Services</h2>
              <p className="text-stone-600 leading-relaxed">Nexpura uses a limited set of third-party services to operate the platform: Stripe for payment processing, Supabase for database and authentication infrastructure, Vercel for application hosting, and Resend for transactional email delivery. Each of these providers maintains their own privacy and security commitments. We do not sell or share your data with third parties for marketing purposes.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">5. Cookies</h2>
              <p className="text-stone-600 leading-relaxed">We use cookies and similar technologies to maintain your authentication session, remember your preferences, and analyse aggregate usage patterns. Essential cookies are required for the Service to function. You can manage non-essential cookies through your browser settings, though disabling essential cookies will affect your ability to use the platform.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">6. Your Rights</h2>
              <p className="text-stone-600 leading-relaxed">You have the right to access, correct, or delete your personal data at any time. You may export your business data at any time from within the platform. To request deletion of your account and associated data, contact us at{" "}
                <a href="mailto:hello@nexpura.com" className="text-amber-700 hover:underline">hello@nexpura.com</a>. We will process your request within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">7. Data Retention</h2>
              <p className="text-stone-600 leading-relaxed">We retain your data for as long as your account is active or as needed to provide the Service. If you cancel your subscription, your data will be retained for 90 days to allow for reactivation, after which it will be permanently deleted. Anonymised, aggregated statistical data may be retained indefinitely.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">8. Changes to This Policy</h2>
              <p className="text-stone-600 leading-relaxed">We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification before they take effect. The date at the top of this page indicates when the policy was last revised.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">9. Contact</h2>
              <p className="text-stone-600 leading-relaxed">For privacy-related questions or to exercise your data rights, please contact us at{" "}
                <a href="mailto:hello@nexpura.com" className="text-amber-700 hover:underline">hello@nexpura.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
