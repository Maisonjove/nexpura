"use client";

import { motion, AnimatePresence } from "framer-motion";

interface MenuSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  items: {
    title: string;
    description: string;
    icon: React.ReactNode;
    href: string;
  }[];
}

interface CompactMenuViewProps {
  sections: MenuSection[];
  activeCategory: string | null;
  setActiveCategory: (id: string | null) => void;
  ActionCard: React.ComponentType<{
    title: string;
    description: string;
    icon: React.ReactNode;
    href: string;
  }>;
}

export default function CompactMenuView({
  sections,
  activeCategory,
  setActiveCategory,
  ActionCard,
}: CompactMenuViewProps) {
  return (
    <AnimatePresence mode="wait">
      {!activeCategory ? (
        <motion.div
          key="categories"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.06 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {sections.map((section, i) => (
            <motion.button
              key={section.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.08, delay: i * 0.01 }}
              onClick={() => setActiveCategory(section.id)}
              className="group flex items-center gap-5 bg-white border border-stone-200 rounded-2xl px-6 py-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400 cursor-pointer text-left"
            >
              <div className="flex-shrink-0 text-stone-400 group-hover:text-[#8B7355] transition-colors duration-400">
                {section.icon}
              </div>
              <div>
                <p className="text-[0.9375rem] font-medium text-stone-900">{section.title}</p>
                <p className="text-[0.8125rem] text-stone-400 mt-0.5 leading-relaxed">{section.description}</p>
              </div>
            </motion.button>
          ))}
        </motion.div>
      ) : (() => {
        const section = sections.find((s) => s.id === activeCategory)!;
        return (
          <motion.section
            key={`category-${activeCategory}`}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.06 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setActiveCategory(null)}
                className="flex items-center gap-1.5 text-[0.8125rem] text-stone-400 hover:text-stone-900 transition-colors duration-200 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h2 className="font-serif text-[1.375rem] text-stone-900">{section.title} Menu</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {section.items.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.06, delay: i * 0.01 }}
                >
                  <ActionCard title={item.title} description={item.description} icon={item.icon} href={item.href} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        );
      })()}
    </AnimatePresence>
  );
}
