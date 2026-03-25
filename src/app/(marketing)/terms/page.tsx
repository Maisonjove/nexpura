import { NavBar } from "@/components/marketing/NavBar";
import { Footer } from "@/components/marketing/Footer";

export const dynamic = "force-static";

export const metadata = {
  title: "Terms of Service — Nexpura",
  description: "Nexpura Terms of Service — your agreement when using the platform.",
};

export default function TermsPage() {
  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h1 className="text-3xl font-semibold text-stone-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-stone-500 mb-10">Last updated: March 2026</p>

          <div className="prose prose-stone max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">1. Acceptance of Terms</h2>
              <p className="text-stone-600 leading-relaxed">By accessing or using Nexpura ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">2. Description of Service</h2>
              <p className="text-stone-600 leading-relaxed">Nexpura is a software-as-a-service platform for jewellery businesses, providing tools for inventory management, point of sale, repairs, bespoke job management, customer relationship management, invoicing, and related business operations.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">3. Account Registration</h2>
              <p className="text-stone-600 leading-relaxed">You must provide accurate and complete information when creating your account. You are responsible for maintaining the security of your account credentials and for all activities that occur under your account.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">4. Subscription and Payment</h2>
              <p className="text-stone-600 leading-relaxed">Nexpura offers subscription plans billed monthly or annually. All payments are processed securely through Stripe. Subscriptions automatically renew unless cancelled before the renewal date. You may cancel your subscription at any time through your account settings.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">5. Data and Privacy</h2>
              <p className="text-stone-600 leading-relaxed">Your business data remains yours. We do not sell or share your data with third parties. Data is stored securely and backed up regularly. Please review our Privacy Policy for full details on how we handle your information.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">6. Acceptable Use</h2>
              <p className="text-stone-600 leading-relaxed">You agree to use Nexpura only for lawful business purposes. You may not use the Service to violate any applicable laws, infringe on third-party rights, or interfere with the operation of the Service.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">7. Service Availability</h2>
              <p className="text-stone-600 leading-relaxed">We strive to maintain high availability but do not guarantee uninterrupted access. Scheduled maintenance will be communicated in advance where possible.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">8. Limitation of Liability</h2>
              <p className="text-stone-600 leading-relaxed">To the maximum extent permitted by law, Nexpura shall not be liable for indirect, incidental, special, or consequential damages arising from your use of the Service.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">9. Changes to Terms</h2>
              <p className="text-stone-600 leading-relaxed">We may update these terms from time to time. We will notify you of significant changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
            </section>

            <section>
              <h2 className="text-xl font-medium text-stone-800 mb-3">10. Contact</h2>
              <p className="text-stone-600 leading-relaxed">For questions about these Terms, please contact us at{" "}
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
