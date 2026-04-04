"use client";

import { useEffect, useState } from "react";
import { onSessionChange, ensureValidSession } from "@/lib/session-monitor";

/**
 * Modal that appears when user session expires.
 * Prevents data loss by prompting re-login before the user loses their work.
 */
export function SessionExpiryModal() {
  const [showModal, setShowModal] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Listen for session changes
    const unsubscribe = onSessionChange((isValid) => {
      if (!isValid) {
        setShowModal(true);
      }
    });

    // Listen for inactivity warning
    const handleWarning = () => {
      setShowWarning(true);
      // Auto-hide warning after 30 seconds
      setTimeout(() => setShowWarning(false), 30000);
    };
    window.addEventListener('session-inactivity-warning', handleWarning);

    return () => {
      unsubscribe();
      window.removeEventListener('session-inactivity-warning', handleWarning);
    };
  }, []);

  const handleStayLoggedIn = async () => {
    setShowWarning(false);
    // Touch the session to keep it alive
    await ensureValidSession();
  };

  const handleLogin = () => {
    // Save current location for redirect back
    sessionStorage.setItem('nexpura_redirect_after_login', window.location.pathname);
    window.location.href = '/login?expired=true';
  };

  // Inactivity warning
  if (showWarning) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-amber-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-800">
                Still there?
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                You&apos;ve been inactive for a while. Click below to stay logged in.
              </p>
              <button
                onClick={handleStayLoggedIn}
                className="mt-2 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 transition-colors"
              >
                I&apos;m still here
              </button>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="text-amber-400 hover:text-amber-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Session expired modal
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-stone-900 px-6 py-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Session Expired
          </h2>
        </div>
        <div className="p-6">
          <p className="text-stone-600 mb-4">
            Your session has expired for security reasons. Please log in again to continue.
          </p>
          <p className="text-sm text-stone-500 mb-6">
            Don&apos;t worry — any data you&apos;ve entered on this page will be saved if possible.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleLogin}
              className="flex-1 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium"
            >
              Log In Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
