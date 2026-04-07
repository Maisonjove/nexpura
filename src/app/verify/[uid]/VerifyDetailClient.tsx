"use client";

import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function VerifyDetailClient({
  children,
  delay = 0,
  animate = false,
}: {
  children: React.ReactNode;
  delay?: number;
  animate?: boolean;
}) {
  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.2, ease: EASE, delay }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(4px)", y: 16 }}
      whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
