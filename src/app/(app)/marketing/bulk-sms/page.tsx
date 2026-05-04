import Link from "next/link";
import { ChatBubbleLeftRightIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

export const metadata = { title: "Bulk SMS — Nexpura" };

export default function BulkSMSPage() {
  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[640px] mx-auto px-6 sm:px-10 lg:px-16 py-20 lg:py-28 text-center">
        <ChatBubbleLeftRightIcon
          className="w-10 h-10 mx-auto text-stone-300 mb-8"
          strokeWidth={1.5}
        />
        <p className="text-[0.75rem] tracking-luxury uppercase text-stone-400 mb-4">
          Marketing
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-stone-900 leading-[1.05] mb-5">
          Bulk SMS has moved
        </h1>
        <p className="text-stone-500 text-base leading-relaxed max-w-md mx-auto mb-10">
          SMS marketing now runs through the WhatsApp campaigns surface — richer
          media, better delivery rates, and the same recipient picker. Plain SMS
          fallback fires automatically when the recipient isn&apos;t reachable on
          WhatsApp.
        </p>
        <Link
          href="/marketing/whatsapp-campaigns"
          className="nx-btn-primary inline-flex items-center gap-2"
        >
          Open WhatsApp Campaigns
          <ArrowRightIcon className="w-4 h-4" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}
