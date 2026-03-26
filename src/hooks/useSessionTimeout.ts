"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 25 * 60 * 1000; // 25 minutes
const CHECK_INTERVAL = 60 * 1000; // Check every minute

export function useSessionTimeout(onWarning?: () => void) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const warningShownRef = useRef(false);

  const resetTimer = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nexpura_last_activity", Date.now().toString());
      // Reset warning state when user is active
      if (warningShownRef.current) {
        warningShownRef.current = false;
        setShowWarning(false);
      }
    }
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login?reason=timeout");
  }, [router]);

  useEffect(() => {
    // Initialize activity timestamp
    resetTimer();

    // Track user activity events
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    
    // Throttle the reset to avoid excessive localStorage writes
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledReset = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          resetTimer();
          throttleTimeout = null;
        }, 1000); // Max once per second
      }
    };

    events.forEach((e) => window.addEventListener(e, throttledReset, { passive: true }));

    // Check for inactivity
    const interval = setInterval(() => {
      const lastActivity = parseInt(
        localStorage.getItem("nexpura_last_activity") || "0"
      );
      const elapsed = Date.now() - lastActivity;

      if (elapsed > TIMEOUT) {
        handleLogout();
      } else if (elapsed > WARNING_TIME && !warningShownRef.current) {
        warningShownRef.current = true;
        setShowWarning(true);
        onWarning?.();
      }
    }, CHECK_INTERVAL);

    return () => {
      events.forEach((e) => window.removeEventListener(e, throttledReset));
      clearInterval(interval);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [resetTimer, handleLogout, onWarning]);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    resetTimer();
  }, [resetTimer]);

  const extendSession = useCallback(() => {
    resetTimer();
    setShowWarning(false);
    warningShownRef.current = false;
  }, [resetTimer]);

  return {
    showWarning,
    dismissWarning,
    extendSession,
    handleLogout,
  };
}
