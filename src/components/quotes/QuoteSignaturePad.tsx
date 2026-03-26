"use client";

import { useState, useRef, useEffect } from "react";
import { PenTool, RotateCcw, Check, X } from "lucide-react";

interface QuoteSignaturePadProps {
  quote: {
    id: string;
    quote_number: string | null;
    total_amount: number;
    customer_name?: string | null;
  };
  onSign: (signatureData: string) => Promise<void>;
  onClose: () => void;
}

export default function QuoteSignaturePad({
  quote,
  onSign,
  onClose,
}: QuoteSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size based on container
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2; // 2x for retina
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing style
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getCoordinates(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }

  function stopDrawing() {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.closePath();
      }
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function handleSubmit() {
    if (!hasSignature) {
      setError("Please provide your signature to accept the quote");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setError(null);

    try {
      const signatureData = canvas.toDataURL("image/png");
      await onSign(signatureData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit signature");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <PenTool className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900">Accept Quote</h2>
              <p className="text-sm text-stone-500">
                Sign to accept quote #{quote.quote_number || quote.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-stone-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Quote Summary */}
          <div className="bg-stone-50 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-stone-500">Quote Total</p>
                <p className="text-2xl font-semibold text-stone-900">
                  ${quote.total_amount.toLocaleString()}
                </p>
              </div>
              {quote.customer_name && (
                <div className="text-right">
                  <p className="text-sm text-stone-500">Customer</p>
                  <p className="text-sm font-medium text-stone-900">
                    {quote.customer_name}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Signature Pad */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide flex items-center gap-2">
                <PenTool className="h-4 w-4" />
                Your Signature
              </label>
              {hasSignature && (
                <button
                  onClick={clearSignature}
                  className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
            <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50">
              <canvas
                ref={canvasRef}
                className="w-full h-40 touch-none cursor-crosshair bg-white"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <p className="text-xs text-stone-400 mt-2">
              Sign above with your mouse or finger to accept this quote.
            </p>
          </div>

          {/* Terms */}
          <div className="text-xs text-stone-500 bg-stone-50 rounded-lg p-3">
            <p>
              By signing above, you agree to accept this quote and authorize the
              work described. This digital signature is legally binding.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-stone-200 text-stone-700 font-medium rounded-lg hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !hasSignature}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-medium py-2.5 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {loading ? "Submitting..." : "Accept Quote"}
          </button>
        </div>
      </div>
    </div>
  );
}
