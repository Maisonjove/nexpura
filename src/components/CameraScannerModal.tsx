"use client";

import { useEffect, useRef, useState } from "react";
import { useCameraScanner } from "@/hooks/useCameraScanner";

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
  title?: string;
}

export default function CameraScannerModal({ onScan, onClose, title = "Scan Barcode" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanned, setScanned] = useState<string | null>(null);

  function handleScan(barcode: string) {
    setScanned(barcode);
    stopScanning();
    setTimeout(() => {
      onScan(barcode);
      onClose();
    }, 600);
  }

  const { startScanning, stopScanning, isScanning, error } = useCameraScanner(handleScan);

  useEffect(() => {
    if (videoRef.current) {
      startScanning(videoRef.current);
    }
    return () => {
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    stopScanning();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h2 className="text-base font-semibold text-stone-900">📷 {title}</h2>
          <button onClick={handleClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Camera viewfinder */}
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Scanning overlay */}
          {isScanning && !scanned && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 relative">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#8B7355] rounded-tl-sm" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#8B7355] rounded-tr-sm" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#8B7355] rounded-bl-sm" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#8B7355] rounded-br-sm" />
                {/* Scan line animation */}
                <div className="absolute left-1 right-1 h-0.5 bg-[#8B7355]/70 animate-bounce" style={{ top: "50%" }} />
              </div>
            </div>
          )}

          {/* Success overlay */}
          {scanned && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold text-base">Scanned!</p>
              <p className="text-white/70 text-sm font-mono mt-1">{scanned}</p>
            </div>
          )}

          {/* Error overlay */}
          {error && !scanned && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-white text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4">
          <p className="text-xs text-stone-500 text-center mb-3">
            Point your camera at a barcode or QR code
          </p>
          <button onClick={handleClose} className="w-full py-2.5 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors">
            Stop Scanning
          </button>
        </div>
      </div>
    </div>
  );
}
