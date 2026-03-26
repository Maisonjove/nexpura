'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle, Mail, Keyboard, BookOpen, Video, Search, ExternalLink, Play, X, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRestartTour } from '@/components/onboarding/tour';

const faqCategories = [
  {
    category: 'Getting Started',
    faqs: [
      {
        q: 'How do I set up my business profile?',
        a: 'Go to Settings → General to update your business name, logo, address, and contact details. These details appear on invoices, receipts, and customer communications.',
      },
      {
        q: 'How do I add my first inventory item?',
        a: 'Navigate to Inventory → New Item. Enter the item details including metal type, stone information, cost price, and retail price. You can also upload photos and attach supplier documents.',
      },
      {
        q: 'How do I create a repair job?',
        a: 'Use New Intake (in the sidebar) or go to Repairs → New Repair. You can search for an existing customer or create a new one on the spot. Take photos at intake to document the item condition.',
      },
      {
        q: 'How do I set up my team members?',
        a: 'Go to Settings → Team & Roles. Invite team members by email and assign them roles. You can configure role permissions to control what each team member can access.',
      },
    ],
  },
  {
    category: 'Repairs & Workshop',
    faqs: [
      {
        q: 'How do I notify a customer their repair is ready?',
        a: "Open the repair job and click the \"Mark as Ready\" button. You'll be prompted to send an SMS or email notification to the customer automatically.",
      },
      {
        q: 'Can customers track their repair online?',
        a: 'Yes. Each repair job has a unique tracking link that you can share with customers. They can check the current stage of their repair without needing to call.',
      },
      {
        q: 'How do I manage the workshop calendar?',
        a: 'Go to Workshop → Calendar to see all active repair and bespoke jobs plotted against your capacity. You can set estimated completion dates on each job.',
      },
    ],
  },
  {
    category: 'POS & Sales',
    faqs: [
      {
        q: 'How do I process a layby?',
        a: 'At the POS screen, after adding items, select "Layby" as the payment type. Set the total amount, any deposit paid today, and the agreed collection date. The customer receives a layby receipt.',
      },
      {
        q: 'How do I handle a trade-in?',
        a: 'In the POS, use the Trade-in option to record the item being exchanged and its agreed value. This credit is applied against the purchase total.',
      },
      {
        q: 'Can I process split payments?',
        a: 'Yes. On the payment screen, you can split a transaction across multiple payment methods — for example, part cash, part card, part store credit.',
      },
    ],
  },
  {
    category: 'Invoices & Finance',
    faqs: [
      {
        q: 'How do I send an invoice to a customer?',
        a: 'Open an invoice and click "Send Invoice". You can email it directly from Nexpura. The invoice includes your business details, itemised line items, and payment terms.',
      },
      {
        q: 'How do I mark an invoice as paid?',
        a: 'Open the invoice and click "Record Payment". Select the payment method and date. The invoice status will update to Paid.',
      },
      {
        q: 'Can I customise invoice templates?',
        a: 'Yes. Go to Settings → Documents to configure your invoice template — logo, colours, payment terms, footer text, and more.',
      },
    ],
  },
  {
    category: 'Customers & CRM',
    faqs: [
      {
        q: "How do I view a customer's full history?",
        a: "Open the customer profile and you'll see all their purchases, repairs, bespoke commissions, and communications in one place.",
      },
      {
        q: 'How do I add birthday or anniversary details?',
        a: 'On the customer profile, scroll to the "Important Dates" section. Add birthday, anniversary, or any other significant dates. These can be used to trigger automated reminder messages.',
      },
      {
        q: 'Can I export my customer list?',
        a: 'Yes. Go to Customers and use the Export button to download a CSV of your customer data.',
      },
    ],
  },
  {
    category: 'Settings & Configuration',
    faqs: [
      {
        q: 'How do I connect my email domain?',
        a: 'Go to Settings → Email Domain. Follow the instructions to add DNS records that verify your domain. Once verified, all outbound emails will come from your business email address.',
      },
      {
        q: 'How do I set up multiple locations?',
        a: 'Go to Settings → Locations to add additional store locations. Team members can be assigned to locations, and inventory can be tracked per location.',
      },
      {
        q: 'How do I configure repair pricing?',
        a: 'Go to Settings → Repairs to set up standard repair types and pricing. These appear as quick-select options when creating new repairs.',
      },
    ],
  },
];

const shortcuts = [
  { keys: ['⌘', 'K'], description: 'Open command palette / global search' },
  { keys: ['⌘', 'N'], description: 'New intake (coming soon)' },
  { keys: ['⌘', '/'], description: 'Focus search bar' },
  { keys: ['Esc'], description: 'Close modal or dismiss' },
  { keys: ['←', '→'], description: 'Navigate between tabs' },
];

const TUTORIALS = [
  {
    id: 'getting-started',
    title: 'Getting Started with Nexpura',
    description: 'A complete walkthrough of setting up your store, adding inventory, and making your first sale.',
    duration: '5:30',
    emoji: '🚀',
    color: 'bg-amber-50 border-amber-200',
    iconColor: 'text-amber-700',
  },
  {
    id: 'first-sale',
    title: 'Making Your First Sale',
    description: 'Learn how to use the POS, process payments, issue receipts, and handle laybys.',
    duration: '3:15',
    emoji: '🛒',
    color: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-700',
  },
  {
    id: 'repairs',
    title: 'Managing Repairs',
    description: 'Track repair jobs from intake to collection, notify customers, and manage the workshop queue.',
    duration: '4:45',
    emoji: '🔧',
    color: 'bg-green-50 border-green-200',
    iconColor: 'text-green-700',
  },
  {
    id: 'inventory',
    title: 'Inventory Management',
    description: 'Add products, set pricing, track stock levels, and list items on your website.',
    duration: '6:00',
    emoji: '📦',
    color: 'bg-purple-50 border-purple-200',
    iconColor: 'text-purple-700',
  },
  {
    id: 'reports',
    title: 'Understanding Reports',
    description: 'Navigate sales reports, inventory valuations, and customer spending analytics.',
    duration: '4:00',
    emoji: '📊',
    color: 'bg-rose-50 border-rose-200',
    iconColor: 'text-rose-700',
  },
  {
    id: 'customers',
    title: 'Customer Management & CRM',
    description: 'Build customer profiles, track loyalty points, send communications, and manage store credit.',
    duration: '3:45',
    emoji: '👥',
    color: 'bg-teal-50 border-teal-200',
    iconColor: 'text-teal-700',
  },
];

function VideoModal({ tutorial, onClose }: { tutorial: typeof TUTORIALS[0]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{tutorial.emoji}</span>
            <div>
              <h3 className="font-semibold text-stone-900">{tutorial.title}</h3>
              <p className="text-xs text-stone-500">{tutorial.duration} • Tutorial</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
            <X className="h-4 w-4 text-stone-500" />
          </button>
        </div>
        <div className="p-6">
          {/* Placeholder video player — replace with real YouTube/Loom embed */}
          <div className="aspect-video bg-gradient-to-br from-stone-100 to-stone-200 rounded-xl flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center">
              <span className="text-3xl">{tutorial.emoji}</span>
            </div>
            <div className="text-center">
              <p className="font-semibold text-stone-700">{tutorial.title}</p>
              <p className="text-sm text-stone-400 mt-1">Video tutorial — {tutorial.duration}</p>
              <p className="text-xs text-stone-400 mt-2">Coming soon — contact support for a live demo</p>
            </div>
          </div>
          <p className="text-sm text-stone-600 mt-4">{tutorial.description}</p>
        </div>
      </div>
    </div>
  );
}

export default function HelpPage() {
  const [openFaqs, setOpenFaqs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVideo, setActiveVideo] = useState<typeof TUTORIALS[0] | null>(null);
  const restartTour = useRestartTour();

  const toggleFaq = (key: string) => {
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredCategories = faqCategories.map((cat) => ({
    ...cat,
    faqs: cat.faqs.filter(
      (faq) =>
        !searchQuery ||
        faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.faqs.length > 0);

  return (
    <TooltipProvider>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-amber-700" />
              </div>
              <h1 className="text-2xl font-semibold text-stone-900">Help & Support</h1>
            </div>
            <p className="text-sm text-stone-500">Find answers, learn shortcuts, and get support.</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={restartTour}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:border-amber-300 hover:text-amber-700 transition-all"
              >
                <RotateCcw className="h-4 w-4" />
                Restart Tour
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Re-run the onboarding tour to get a guided walkthrough of Nexpura</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a
            href="mailto:support@nexpura.com"
            className="flex items-center gap-3 p-4 bg-white border border-stone-200 rounded-xl hover:border-amber-300 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">Email Support</p>
              <p className="text-xs text-stone-500">support@nexpura.com</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-stone-400 ml-auto" />
          </a>
          <button
            onClick={() => document.getElementById('video-tutorials')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-3 p-4 bg-white border border-stone-200 rounded-xl hover:border-amber-300 hover:shadow-sm transition-all text-left"
          >
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <Video className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">Video Tutorials</p>
              <p className="text-xs text-stone-500">6 tutorials available</p>
            </div>
          </button>
          <div className="flex items-center gap-3 p-4 bg-white border border-stone-200 rounded-xl opacity-60 cursor-not-allowed">
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">Documentation</p>
              <p className="text-xs text-stone-500">Coming soon</p>
            </div>
          </div>
        </div>

        {/* Video Tutorials */}
        <div id="video-tutorials">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Video className="h-4 w-4 text-purple-700" />
            </div>
            <h2 className="text-lg font-semibold text-stone-900">Video Tutorials</h2>
          </div>
          <p className="text-sm text-stone-500 mb-5">Step-by-step video guides to help you get the most out of Nexpura.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TUTORIALS.map((tutorial) => (
              <button
                key={tutorial.id}
                onClick={() => setActiveVideo(tutorial)}
                className={`text-left p-4 rounded-xl border ${tutorial.color} hover:shadow-sm transition-all group`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{tutorial.emoji}</span>
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 bg-white/70 px-2 py-1 rounded-full">
                    <Play className="h-3 w-3" />
                    {tutorial.duration}
                  </div>
                </div>
                <p className={`text-sm font-semibold ${tutorial.iconColor} mb-1`}>{tutorial.title}</p>
                <p className="text-xs text-stone-500 line-clamp-2">{tutorial.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Keyboard className="h-4 w-4 text-stone-600" />
            <h2 className="font-semibold text-stone-900">Keyboard Shortcuts</h2>
          </div>
          <div className="space-y-2">
            {shortcuts.map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-stone-600">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, j) => (
                    <kbd
                      key={j}
                      className="px-2 py-0.5 text-[11px] font-mono bg-white border border-stone-200 rounded text-stone-700 shadow-sm"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ search */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-stone-900">Frequently Asked Questions</h2>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-stone-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Browse answers to common questions, or use the search to find specific topics.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-8 text-sm text-stone-500">
              No results found for &quot;{searchQuery}&quot;
            </div>
          )}

          <div className="space-y-6">
            {filteredCategories.map((cat) => (
              <div key={cat.category}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">
                  {cat.category}
                </h3>
                <div className="space-y-2">
                  {cat.faqs.map((faq, i) => {
                    const key = `${cat.category}-${i}`;
                    const isOpen = openFaqs.has(key);
                    return (
                      <div
                        key={key}
                        className="bg-white border border-stone-200 rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => toggleFaq(key)}
                          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition-colors"
                        >
                          <span className="text-sm font-medium text-stone-900 pr-4">{faq.q}</span>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-stone-400 shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4 text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-3">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Getting started guide */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="font-semibold text-stone-900 mb-2">🚀 Getting Started Checklist</h2>
          <p className="text-sm text-stone-600 mb-4">Complete these steps to get fully set up on Nexpura.</p>
          <div className="space-y-2">
            {[
              { task: 'Complete your business profile', href: '/settings' },
              { task: 'Add your logo and branding', href: '/settings' },
              { task: 'Set up your team members', href: '/settings/roles' },
              { task: 'Add your first inventory items', href: '/inventory/new' },
              { task: 'Configure your invoice template', href: '/settings/documents' },
              { task: 'Set up payment methods', href: '/settings/payments' },
              { task: 'Try creating a repair job', href: '/repairs/new' },
              { task: 'Create your first sale', href: '/pos' },
            ].map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="flex items-center gap-3 text-sm text-stone-700 hover:text-amber-700 transition-colors group"
              >
                <div className="w-5 h-5 border-2 border-stone-300 rounded group-hover:border-amber-500 transition-colors flex items-center justify-center text-xs font-bold text-stone-400">
                  {i + 1}
                </div>
                <span>{item.task}</span>
                <ChevronRight className="h-3.5 w-3.5 text-stone-300 group-hover:text-amber-500 ml-auto transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Still need help */}
        <div className="text-center py-6 border-t border-stone-100">
          <p className="text-sm text-stone-500 mb-3">Still need help?</p>
          <a
            href="mailto:support@nexpura.com"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Contact Support
          </a>
        </div>
      </div>

      {/* Video Modal */}
      {activeVideo && (
        <VideoModal tutorial={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </TooltipProvider>
  );
}
