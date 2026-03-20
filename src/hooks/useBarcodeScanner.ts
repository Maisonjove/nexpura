import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  maxIntervalMs?: number;
  enabled?: boolean;
}

/**
 * Detects USB barcode scanner input:
 * - Characters arrive rapidly (>minLength chars within maxIntervalMs ms)
 * - Terminated by Enter key
 * - Works by tracking keypress events on document
 */
export function useBarcodeScanner({
  onScan,
  minLength = 6,
  maxIntervalMs = 300,
  enabled = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';

      // If in an input field, skip (scanner fields handle themselves)
      if (isInputField) return;

      const now = Date.now();

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          const barcode = bufferRef.current;
          bufferRef.current = '';
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          onScan(barcode);
        } else {
          bufferRef.current = '';
        }
        return;
      }

      // Only track printable characters
      if (e.key.length !== 1) return;

      // Check if input is rapid enough (scanner mode)
      const timeSinceLast = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (timeSinceLast > maxIntervalMs && bufferRef.current.length > 0) {
        // Too slow — probably human typing, reset buffer
        bufferRef.current = '';
      }

      bufferRef.current += e.key;

      // Auto-reset after maxIntervalMs of no input
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = '';
        timerRef.current = null;
      }, maxIntervalMs);
    },
    [enabled, minLength, maxIntervalMs, onScan]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, handleKeyDown]);
}
