"use client";
import { useRef, useState } from "react";

export interface PhotoMatch {
  id: string;
  item_name: string;
  quantity: number;
}

interface Props {
  stocktakeId: string;
  onApply: (matches: PhotoMatch[]) => void;
  onClose: () => void;
}

type Stage = "capture" | "analysing" | "results";

export default function PhotoScannerModal({ stocktakeId, onApply, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<Stage>("capture");
  const [matches, setMatches] = useState<PhotoMatch[]>([]);
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
      setStage("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setStage("capture");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.split(",")[1];
    stopCamera();
    analyseImage(base64, "image/jpeg");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      const mimeType = file.type || "image/jpeg";
      analyseImage(base64, mimeType);
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => { onApply(matches); onClose(); };
  const handleClose = () => { stopCamera(); onClose(); };

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
                </div>
              )}
            </div>
          )}
          {stage === "analysing" && (
            <div className="py-10 text-center space-y-3">
              <div className="text-4xl animate-pulse">&#128269;</div>
              <p className="text-gray-600 font-medium">Analysing photo...</p>
              <p className="text-sm text-gray-400">Claude is identifying items</p>
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
                  <p className="text-sm text-gray-500">{matches.length} item(s) identified:</p>
                  <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {matches.map((m) => (
                      <li key={m.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-800">{m.item_name}</span>
                        <span className="text-sm font-bold text-amber-700">x{m.quantity}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={handleApply} className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600">
                    Apply Counts
                  </button>
                </>
              )}
              <button
                onClick={() => { setStage("capture"); setMatches([]); setError(null); }}
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
