"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import React from "react";
import {
  addPassportEvent,
  transferOwnership,
  togglePublicStatus,
  resendPassportEmail,
} from "../actions";

interface Passport {
  id: string;
  passport_uid: string;
  title: string;
  jewellery_type: string | null;
  description: string | null;
  metal_type: string | null;
  metal_colour: string | null;
  metal_purity: string | null;
  metal_weight_grams: number | null;
  stone_type: string | null;
  stone_shape: string | null;
  stone_carat: number | null;
  stone_colour: string | null;
  stone_clarity: string | null;
  stone_origin: string | null;
  stone_cert_number: string | null;
  ring_size: string | null;
  setting_style: string | null;
  maker_name: string | null;
  made_in: string | null;
  year_made: number | null;
  current_owner_name: string | null;
  current_owner_email: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  status: string;
  is_public: boolean;
  verified_at: string | null;
  created_at: string;
}

interface PassportEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

const EVENT_TYPES = [
  { value: "repaired", label: "Repaired" },
  { value: "serviced", label: "Serviced" },
  { value: "resized", label: "Resized" },
  { value: "stone_replaced", label: "Stone Replaced" },
  { value: "authenticated", label: "Authenticated" },
  { value: "insured", label: "Insured" },
  { value: "reported_lost", label: "Reported Lost" },
  { value: "reported_stolen", label: "Reported Stolen" },
  { value: "recovered", label: "Recovered" },
];

const EVENT_ICONS: Record<string, React.ReactElement> = {
  created: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
    </svg>
  ),
  updated: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  ownership_transferred: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  repaired: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    </svg>
  ),
  serviced: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  resized: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  ),
  stone_replaced: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
    </svg>
  ),
  authenticated: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  insured: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  reported_lost: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  reported_stolen: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  recovered: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
};

function eventLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</dt>
      <dd className="text-sm text-stone-900 font-medium mt-0.5">{value}</dd>
    </div>
  );
}

export default function PassportDetailClient({
  passport,
  events,
}: {
  passport: Passport;
  events: PassportEvent[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isPublic, setIsPublic] = useState(passport.is_public);
  const [emailSending, setEmailSending] = useState(false);
  const [emailToast, setEmailToast] = useState<string | null>(null);

  // Add event modal
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventType, setEventType] = useState("repaired");
  const [eventNotes, setEventNotes] = useState("");
  const [eventLoading, setEventLoading] = useState(false);

  // Transfer modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    `https://nexpura-delta.vercel.app/verify/${passport.passport_uid}`
  )}`;
  const qrDownloadUrl = `${qrUrl}&download=1`;
  const verifyUrl = `/verify/${passport.passport_uid}`;

  async function handleTogglePublic() {
    const newVal = !isPublic;
    setIsPublic(newVal);
    startTransition(async () => {
      await togglePublicStatus(passport.id, newVal);
    });
  }

  async function handleSendPassportEmail() {
    setEmailSending(true);
    setEmailToast(null);
    try {
      const result = await resendPassportEmail(passport.id);
      if (result.success) {
        setEmailToast(`Passport email sent to ${passport.current_owner_email}`);
      } else {
        setEmailToast(`Failed: ${result.error}`);
      }
    } finally {
      setEmailSending(false);
      setTimeout(() => setEmailToast(null), 5000);
    }
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    setEventLoading(true);
    try {
      await addPassportEvent(passport.id, eventType, eventNotes, {});
      setEventModalOpen(false);
      setEventType("repaired");
      setEventNotes("");
    } finally {
      setEventLoading(false);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setTransferLoading(true);
    try {
      await transferOwnership(passport.id, newOwnerName, newOwnerEmail, transferNotes);
      setTransferModalOpen(false);
      setNewOwnerName("");
      setNewOwnerEmail("");
      setTransferNotes("");
    } finally {
      setTransferLoading(false);
    }
  }

  const hasStone = passport.stone_type || passport.stone_carat || passport.stone_colour || passport.stone_clarity;
  const hasRing = passport.ring_size || passport.setting_style;
  const hasMetal = passport.metal_type || passport.metal_purity || passport.metal_weight_grams;

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold bg-stone-100 text-[#8B7355] px-3 py-1 rounded-lg">
            {passport.passport_uid}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            passport.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${passport.status === "active" ? "bg-green-500" : "bg-gray-400"}`} />
            {passport.status}
          </span>
        </div>
        <Link
          href={`/passports/${passport.id}/edit`}
          className="px-4 py-2 border border-stone-900 text-stone-900 text-sm font-medium rounded-lg hover:bg-stone-900/5 transition-colors"
        >
          Edit Passport
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — 65% */}
        <div className="lg:col-span-2 space-y-5">
          {/* Title card */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h1 className="font-semibold text-2xl font-semibold text-stone-900">{passport.title}</h1>
            {passport.jewellery_type && (
              <p className="text-sm text-gray-500 mt-1 capitalize">{passport.jewellery_type.replace(/_/g, " ")}</p>
            )}
            {passport.description && (
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">{passport.description}</p>
            )}
          </div>

          {/* Specifications */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-lg font-semibold text-stone-900 mb-4">Specifications</h2>
            <div className="space-y-5">
              {hasMetal && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Metal</h3>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <SpecRow label="Type" value={passport.metal_type?.replace(/_/g, " ")} />
                    <SpecRow label="Colour" value={passport.metal_colour} />
                    <SpecRow label="Purity" value={passport.metal_purity} />
                    <SpecRow label="Weight" value={passport.metal_weight_grams ? `${passport.metal_weight_grams}g` : null} />
                  </dl>
                </div>
              )}

              {hasStone && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Stone</h3>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <SpecRow label="Type" value={passport.stone_type} />
                    <SpecRow label="Shape" value={passport.stone_shape?.replace(/_/g, " ")} />
                    <SpecRow label="Carat" value={passport.stone_carat ? `${passport.stone_carat}ct` : null} />
                    <SpecRow label="Colour" value={passport.stone_colour} />
                    <SpecRow label="Clarity" value={passport.stone_clarity} />
                    <SpecRow label="Origin" value={passport.stone_origin} />
                    <SpecRow label="Certificate" value={passport.stone_cert_number} />
                  </dl>
                </div>
              )}

              {hasRing && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ring</h3>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <SpecRow label="Size" value={passport.ring_size} />
                    <SpecRow label="Setting" value={passport.setting_style} />
                  </dl>
                </div>
              )}

              {(passport.maker_name || passport.made_in || passport.year_made) && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Provenance</h3>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <SpecRow label="Maker" value={passport.maker_name} />
                    <SpecRow label="Made In" value={passport.made_in} />
                    <SpecRow label="Year" value={passport.year_made} />
                  </dl>
                </div>
              )}

              {(passport.current_owner_name || passport.purchase_date || passport.purchase_price) && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ownership</h3>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <SpecRow label="Owner" value={passport.current_owner_name} />
                    <SpecRow label="Email" value={passport.current_owner_email} />
                    <SpecRow label="Purchase Date" value={passport.purchase_date ? new Date(passport.purchase_date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : null} />
                    <SpecRow label="Purchase Price" value={passport.purchase_price ? `$${passport.purchase_price.toLocaleString()}` : null} />
                  </dl>
                </div>
              )}
            </div>
          </div>

          {/* Event Timeline */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-lg font-semibold text-stone-900 mb-4">Event Timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-gray-400">No events recorded yet.</p>
            ) : (
              <div className="space-y-0">
                {events.map((event, idx) => (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        event.event_type === "created" ? "bg-stone-100 text-[#8B7355]" :
                        event.event_type === "ownership_transferred" ? "bg-stone-100 text-stone-700" :
                        event.event_type === "reported_lost" || event.event_type === "reported_stolen" ? "bg-red-50 text-red-500" :
                        event.event_type === "recovered" || event.event_type === "authenticated" ? "bg-green-50 text-green-600" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {EVENT_ICONS[event.event_type] || EVENT_ICONS["updated"]}
                      </div>
                      {idx < events.length - 1 && (
                        <div className="w-px flex-1 bg-stone-200 my-1" />
                      )}
                    </div>
                    <div className={`pb-5 flex-1 min-w-0 ${idx < events.length - 1 ? "" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-stone-900">{eventLabel(event.event_type)}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {new Date(event.created_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {event.notes && (
                        <p className="text-sm text-gray-500 mt-0.5">{event.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — 35% */}
        <div className="space-y-5">
          {/* QR Code card */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">QR Code</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`QR Code for ${passport.passport_uid}`}
              width={180}
              height={180}
              className="mx-auto rounded-lg border border-stone-200"
            />
            <p className="text-xs text-gray-400 mt-3 break-all">
              nexpura-delta.vercel.app/verify/{passport.passport_uid}
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <a
                href={qrDownloadUrl}
                download={`passport-${passport.passport_uid}.png`}
                className="w-full px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download QR Code
              </a>
              <a
                href={verifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-2 border border-stone-900 text-stone-900 text-sm font-medium rounded-lg hover:bg-stone-900/5 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Public Page
              </a>
            </div>
          </div>

          {/* Visibility card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-900">Public Visibility</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isPublic ? "Verifiable by anyone" : "Private — not publicly accessible"}
                </p>
              </div>
              <button
                onClick={handleTogglePublic}
                disabled={isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPublic ? "bg-[#8B7355]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    isPublic ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Actions card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Actions</p>

            {/* Download Certificate */}
            <a
              href={`/api/passport/${passport.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#071A0D] text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Certificate
            </a>

            <button
              onClick={() => setEventModalOpen(true)}
              className="w-full px-4 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Event
            </button>
            <button
              onClick={() => setTransferModalOpen(true)}
              className="w-full px-4 py-2.5 border border-stone-900 text-stone-900 text-sm font-medium rounded-lg hover:bg-stone-900/5 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Transfer Ownership
            </button>
            {passport.current_owner_email && (
              <button
                onClick={handleSendPassportEmail}
                disabled={emailSending}
                className="w-full px-4 py-2.5 border border-[#8B7355] text-[#8B7355] text-sm font-medium rounded-lg hover:bg-[#8B7355]/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {emailSending ? "Sending…" : "Send Passport Email"}
              </button>
            )}
          </div>

          {/* Email toast */}
          {emailToast && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
              emailToast.startsWith("Failed")
                ? "bg-red-50 text-red-600 border border-red-100"
                : "bg-stone-100 text-[#8B7355] border border-[#8B7355]/20"
            }`}>
              {!emailToast.startsWith("Failed") && (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {emailToast}
            </div>
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEventModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
            <h3 className="font-semibold text-xl font-semibold text-stone-900 mb-5">Add Event</h3>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355] transition-colors"
                >
                  {EVENT_TYPES.map((et) => (
                    <option key={et.value} value={et.value}>{et.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
                <textarea
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any relevant notes…"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355] transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-stone-900 text-stone-900 text-sm font-medium rounded-lg hover:bg-stone-900/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={eventLoading}
                  className="flex-1 px-4 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-60"
                >
                  {eventLoading ? "Adding…" : "Add Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTransferModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
            <h3 className="font-semibold text-xl font-semibold text-stone-900 mb-1">Transfer Ownership</h3>
            <p className="text-sm text-gray-500 mb-5">Update the current owner of this passport</p>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">New Owner Name</label>
                <input
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">New Owner Email</label>
                <input
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  type="email"
                  placeholder="email@example.com"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Sold at auction, gifted for birthday…"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355] transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-stone-900 text-stone-900 text-sm font-medium rounded-lg hover:bg-stone-900/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="flex-1 px-4 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-60"
                >
                  {transferLoading ? "Transferring…" : "Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
