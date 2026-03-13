"use client";

import { useState, useRef, useCallback } from "react";

interface UseCameraScannerReturn {
  startScanning: (videoElement: HTMLVideoElement) => Promise<void>;
  stopScanning: () => void;
  lastScan: string | null;
  isScanning: boolean;
  error: string | null;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    BarcodeDetector?: any;
  }
}

export function useCameraScanner(onScan?: (barcode: string) => void): UseCameraScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScanRef = useRef<string | null>(null);

  const stopScanning = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async (videoElement: HTMLVideoElement) => {
    setError(null);
    setLastScan(null);
    lastScanRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      videoElement.srcObject = stream;
      await videoElement.play();
      setIsScanning(true);

      // Use BarcodeDetector API if available (Chromium)
      if (typeof window !== "undefined" && window.BarcodeDetector) {
        const detector = new window.BarcodeDetector({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "data_matrix"],
        });

        const scan = async () => {
          if (!streamRef.current) return;
          try {
            const barcodes = await detector.detect(videoElement);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue as string;
              if (code && code !== lastScanRef.current) {
                lastScanRef.current = code;
                setLastScan(code);
                onScan?.(code);
              }
            }
          } catch {
            // continue scanning
          }
          animFrameRef.current = requestAnimationFrame(() => setTimeout(scan, 150));
        };

        animFrameRef.current = requestAnimationFrame(scan);
      } else {
        // Fallback: canvas-based QR code detection using a basic approach
        // For production, this would use @zxing/browser
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const scan = () => {
          if (!streamRef.current || !ctx) return;
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          ctx.drawImage(videoElement, 0, 0);
          // Without a library, we can't decode here — show a message
          animFrameRef.current = requestAnimationFrame(() => setTimeout(scan, 500));
        };

        scan();
        setError("For best scanning support, use Chrome or Edge. QR detection is limited in this browser.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setError(
        msg.includes("Permission denied") || msg.includes("NotAllowed")
          ? "Camera permission denied. Please allow camera access and try again."
          : msg
      );
      setIsScanning(false);
    }
  }, [onScan]);

  return { startScanning, stopScanning, lastScan, isScanning, error };
}
