"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ShieldCheck,
  ShieldAlert,
  Camera,
  Search,
  Loader2,
  ScanLine,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { verifyPassport, type VerifyResult } from "./actions";

// Existing camera modal supports QR via BarcodeDetector — see
// src/hooks/useCameraScanner.ts. Loaded lazily so the form ships
// without dragging in the camera bundle on first paint.
const CameraScannerModal = dynamic(
  () => import("@/components/CameraScannerModal"),
  { ssr: false }
);

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function VerifyPassportClient() {
  const [serial, setSerial] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isPending, startTransition] = useTransition();

  function runVerify(value: string) {
    const cleaned = value.trim();
    if (!cleaned) return;
    startTransition(async () => {
      const r = await verifyPassport(cleaned);
      setResult(r);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    runVerify(serial);
  }

  function onScan(value: string) {
    // BarcodeDetector returns the QR's raw string. Customers' QR codes
    // typically encode the passport-verify URL (.../verify/<uid>) — pull
    // the trailing UID segment if so, otherwise treat the whole string
    // as the serial.
    let parsed = value;
    try {
      const url = new URL(value);
      const segments = url.pathname.split("/").filter(Boolean);
      const last = segments[segments.length - 1];
      if (last) parsed = last;
    } catch {
      // Not a URL — use the raw string.
    }
    setSerial(parsed);
    setShowCamera(false);
    runVerify(parsed);
  }

  // Desktop fallback for the "Scan QR" button — opens a file picker on
  // browsers without camera/BarcodeDetector. The user can take a photo
  // (mobile capture=environment) or upload one. We don't decode the QR
  // image client-side here; we just surface the file's filename if it
  // contains the UID, or fall back to manual entry.
  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // If the filename already contains the UID (common when a customer
    // saves their passport as e.g. "NXP-A1B2C3.png"), pull it out.
    const match = file.name.match(/(NXP-[A-F0-9]{6}|\d{6,12})/i);
    if (match) {
      setSerial(match[1]);
      runVerify(match[1]);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {showCamera && (
        <CameraScannerModal
          title="Scan Passport QR"
          onScan={onScan}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Header */}
      <div>
        <nav className="flex items-center gap-1.5 mb-2">
          <Link
            href="/passports"
            className="text-xs text-nexpura-charcoal-500 hover:text-nexpura-charcoal-700 transition-colors"
          >
            Passports
          </Link>
          <span className="text-nexpura-taupe-200 text-xs">/</span>
          <span className="text-xs text-nexpura-charcoal-700 font-medium">Verify</span>
        </nav>
        <h1 className="text-2xl font-bold text-nexpura-charcoal-700">Verify Passport</h1>
        <p className="text-sm text-nexpura-charcoal-500 mt-1">
          Enter a passport ID, serial, or scan the QR code from a customer&rsquo;s certificate.
        </p>
      </div>

      {/* Verify form */}
      <Card className="border-nexpura-taupe-100 bg-nexpura-ivory-elevated p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-nexpura-charcoal-500">
              Passport ID or serial
            </span>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nexpura-charcoal-500" />
                <Input
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="NXP-A1B2C3 or 100000001"
                  autoComplete="off"
                  spellCheck={false}
                  className="pl-10 h-11 border-nexpura-taupe-100 bg-white"
                />
              </div>
              <Button
                type="submit"
                disabled={isPending || !serial.trim()}
                className="h-11 bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verify
                  </>
                )}
              </Button>
            </div>
          </label>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCamera(true)}
              className="h-10 border-nexpura-taupe-100 text-nexpura-charcoal-700 hover:bg-nexpura-warm"
            >
              <Camera className="w-4 h-4" />
              Scan QR (camera)
            </Button>
            <label className="inline-flex items-center justify-center h-10 px-3 border border-nexpura-taupe-100 rounded-md text-sm text-nexpura-charcoal-700 hover:bg-nexpura-warm cursor-pointer transition-colors">
              <ScanLine className="w-4 h-4 mr-2" />
              Upload QR image
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFileChosen}
                className="hidden"
              />
            </label>
          </div>
        </form>
      </Card>

      {/* Result card */}
      {result && (
        <Card
          className={`border ${
            result.found
              ? "border-nexpura-emerald-deep/20 bg-nexpura-emerald-bg/40"
              : "border-nexpura-oxblood/20 bg-nexpura-oxblood-bg/40"
          } p-6`}
        >
          {result.found ? (
            <ResultFound data={result.data} />
          ) : (
            <ResultNotFound />
          )}
        </Card>
      )}
    </div>
  );
}

function ResultFound({
  data,
}: {
  data: Extract<VerifyResult, { found: true }>["data"];
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-nexpura-emerald-deep flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-nexpura-emerald-deep">
            Authentic
          </p>
          <h2 className="text-xl font-semibold text-nexpura-charcoal-700 truncate">
            {data.title}
          </h2>
          <p className="text-xs text-nexpura-charcoal-500 mt-0.5 font-mono">
            {data.passport_uid}
            {data.identity_number ? ` · #${data.identity_number}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        {data.primary_image && (
          <div className="w-full sm:w-40 aspect-square rounded-xl overflow-hidden bg-nexpura-warm flex-shrink-0">
            <Image
              src={data.primary_image}
              alt={data.title}
              width={320}
              height={320}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 flex-1 text-sm">
          <SpecRow label="Type" value={data.jewellery_type?.replace(/_/g, " ") ?? null} />
          <SpecRow label="Metal" value={data.metal_type} />
          <SpecRow label="Stones" value={data.stone_type} />
          <SpecRow
            label="Owner"
            value={data.current_owner_name}
          />
          <SpecRow label="Status" value={data.status.replace(/_/g, " ")} />
          <SpecRow label="Visibility" value={data.is_public ? "Public" : "Private"} />
        </dl>
      </div>

      <div className="border-t border-nexpura-taupe-100 pt-4 flex flex-col sm:flex-row gap-4 text-xs text-nexpura-charcoal-500">
        <div className="inline-flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          Issued {formatDate(data.created_at)}
        </div>
        <div className="inline-flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          Last verified {formatDate(data.verified_at)}
        </div>
        <Link
          href={`/passports/${data.id}`}
          className="ml-auto text-nexpura-charcoal-700 hover:text-nexpura-charcoal underline-offset-2 hover:underline"
        >
          View full passport
        </Link>
      </div>
    </div>
  );
}

function ResultNotFound() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-nexpura-oxblood flex items-center justify-center flex-shrink-0">
        <ShieldAlert className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-nexpura-oxblood">
          Not recognised
        </p>
        <h2 className="text-base font-semibold text-nexpura-charcoal-700 mt-1">
          Passport not recognised
        </h2>
        <p className="text-sm text-nexpura-charcoal-500 mt-1">
          Check the ID and try again, or contact support if you believe this is an error.
        </p>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-nexpura-charcoal-500">
        {label}
      </dt>
      <dd className="text-sm text-nexpura-charcoal-700 mt-0.5 capitalize">
        {value ?? "—"}
      </dd>
    </div>
  );
}
