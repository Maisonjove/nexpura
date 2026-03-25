"use client";
import { useRef, useState } from "react";

export interface PhotoMatch {
  id: string;
  item_name: string;
  quantity: number;
  confidence?: number;
  match_reason?: string;
  low_confidence?: boolean;
}

interface Props {
  stocktakeId: string;
  onApply: (matches: PhotoMatch[]) => void;
  onClose: () => void;
}

type Stage = "capture" | "analysing" | "results";

// Max image dimension (px) — images larger than this are downscaled before sending
const MAX_IMAGE_DIM = 1280;
// JPEG quality for compressed output (0–1)
const JPEG_QUALITY = 0.82;

/**
 * Compress an image by drawing onto a canvas at MAX_IMAGE_DIM and re-encoding as JPEG.
 * Returns { base64, mimeType } ready to POST.
 */
function compressImage(dataUrl: string, maxDim = MAX_IMAGE_DIM, quality = JPEG_QUALITY): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve({ base64: compressed.split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export default function PhotoScannerModal({ stocktakeId, onApply, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<Stage>("capture");
  const [matches, setMatches] = useState<PhotoMatch[]>([]);
  const [fromInventory, setFromInventory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setError("Could not access camera. Please allow camera access or upload a photo.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const analyseImage = async (imageBase64: string, mimeType: string) => {
    setStage("analysing");
    try {
      const res = await fetch("/api/stocktakes/photo-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, stocktakeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyse");
      setMatches(data.matches || []);
      setFromInventory(data.from_inventory || false);
      setStage("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setStage("capture");
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
    stopCamera();
    try {
      const { base64, mimeType } = await compressImage(dataUrl);
      analyseImage(base64, mimeType);
    } catch {
      // Fallback: send uncompressed
      analyseImage(dataUrl.split(",")[1], "image/jpeg");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10 MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image file is too large (max 10 MB). Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const { base64, mimeType } = await compressImage(dataUrl);
        analyseImage(base64, mimeType);
      } catch {
        // Fallback: send as-is
        const base64 = dataUrl.split(",")[1];
        const mimeType = file.type || "image/jpeg";
        analyseImage(base64, mimeType);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => { onApply(matches); onClose(); };
  const handleClose = () => { stopCamera(); onClose(); };
  const handleReset = () => { setStage("capture"); setMatches([]); setFromInventory(false); setError(null); };

  const confidenceColor = (confidence?: number) => {
    if (!confidence) return "bg-amber-50";
    if (confidence >= 85) return "bg-green-50 border-green-200";
    if (confidence >= 70) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

  const confidenceBadge = (confidence?: number) => {
    if (!confidence) return null;
    const color = confidence >= 85 ? "text-green-700 bg-green-100" : confidence >= 70 ? "text-amber-700 bg-amber-100" : "text-red-700 bg-red-100";
    return (
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${color}`}>
        {confidence}%
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">AI Photo Scan</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl">&#x2715;</button>
        </div>
        <div className="p-4">
          {stage === "capture" && (
            <div className="space-y-3">
              {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
              {cameraActive ? (
                <div className="space-y-3">
                  <video ref={videoRef} className="w-full rounded-lg bg-black" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <button onClick={capturePhoto} className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600">
                      Capture
                    </button>
                    <button onClick={stopCamera} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <canvas ref={canvasRef} className="hidden" />
                  <button onClick={startCamera} className="w-full py-3 border-2 border-dashed border-amber-300 rounded-xl text-amber-700 hover:bg-amber-50 font-medium">
                    Open Camera
                  </button>
                  <div className="text-center text-sm text-gray-400">or</div>
                  <label className="block w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 cursor-pointer text-center font-medium">
                    Upload Photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                  <p className="text-xs text-gray-400 text-center">Images are compressed automatically · Max 10 MB</p>
                </div>
              )}
            </div>
          )}
          {stage === "analysing" && (
            <div className="py-10 text-center space-y-3">
              <div className="text-4xl animate-pulse">&#128269;</div>
              <p className="text-gray-600 font-medium">Analysing photo...</p>
              <p className="text-sm text-gray-400">AI is identifying and matching items</p>
            </div>
          )}
          {stage === "results" && (
            <div className="space-y-3">
              {matches.length === 0 ? (
                <div className="py-6 text-center text-gray-500">
                  <p className="text-2xl mb-2">&#129335;</p>
                  <p>No matching items found.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500">{matches.length} item(s) identified{fromInventory ? " (matched from full inventory)" : ""}:</p>
                  {fromInventory && (
                    <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2">
                      ℹ️ These items were discovered from your full inventory catalogue.
                    </div>
                  )}
                  {matches.some((m) => m.low_confidence) && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      ⚠️ Some matches have low confidence — review carefully before applying.
                    </div>
                  )}
                  <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {matches.map((m) => (
                      <li key={m.id} className={`flex justify-between items-center p-3 rounded-lg border ${confidenceColor(m.confidence)}`}>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800 block truncate">{m.item_name}</span>
                          {m.match_reason && <span className="text-xs text-gray-400 block truncate">{m.match_reason}</span>}
                        </div>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          {confidenceBadge(m.confidence)}
                          <span className="text-sm font-bold text-amber-700">x{m.quantity}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button onClick={handleApply} className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600">
                    Apply Counts
                  </button>
                </>
              )}
              <button
                onClick={handleReset}
                className="w-full py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                Scan Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
