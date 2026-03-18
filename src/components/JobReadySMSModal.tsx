"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Settings, Loader2, Check, X, AlertCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sendSms: boolean, message: string) => Promise<void>;
  customerName: string;
  customerPhone: string | null;
  jobType: string;
  businessName: string;
  defaultTemplate: string;
  twilioConnected: boolean;
}

export default function JobReadySMSModal({
  isOpen,
  onClose,
  onConfirm,
  customerName,
  customerPhone,
  jobType,
  businessName,
  defaultTemplate,
  twilioConnected,
}: Props) {
  const [sendSms, setSendSms] = useState(twilioConnected && !!customerPhone);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize message with template when modal opens
  useEffect(() => {
    if (isOpen) {
      const filledTemplate = defaultTemplate
        .replace(/\{\{\s*customer_name\s*\}\}/gi, customerName || "there")
        .replace(/\{\{\s*job_type\s*\}\}/gi, jobType || "item")
        .replace(/\{\{\s*business_name\s*\}\}/gi, businessName || "our store");
      setMessage(filledTemplate);
      setSendSms(twilioConnected && !!customerPhone);
    }
  }, [isOpen, defaultTemplate, customerName, jobType, businessName, twilioConnected, customerPhone]);

  if (!isOpen) return null;

  const charCount = message.length;
  const segmentCount = charCount <= 160 ? 1 : Math.ceil(charCount / 153);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(sendSms, message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            Mark as Ready
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* SMS Option */}
          <div className="space-y-3">
            {twilioConnected && customerPhone ? (
              <>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendSms}
                    onChange={(e) => setSendSms(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-medium text-stone-900">Notify customer via SMS</span>
                    <p className="text-sm text-stone-500">
                      Send a text message to {customerPhone}
                    </p>
                  </div>
                </label>

                {sendSms && (
                  <div className="ml-8 space-y-3">
                    {/* Editable Message */}
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        Message
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="Enter your message..."
                      />
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs ${charCount > 160 ? "text-amber-600" : "text-stone-400"}`}>
                          {charCount} characters
                          {segmentCount > 1 && ` (${segmentCount} SMS segments)`}
                        </span>
                        {charCount > 320 && (
                          <span className="text-xs text-amber-600">Consider shortening</span>
                        )}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Preview</p>
                      <p className="text-sm text-stone-700">{message}</p>
                    </div>
                  </div>
                )}
              </>
            ) : twilioConnected && !customerPhone ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">No phone number on file</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Add a mobile number to the customer profile to send SMS notifications.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-stone-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-stone-700">SMS notifications not set up</p>
                    <p className="text-xs text-stone-500 mt-1">
                      Connect Twilio to automatically notify customers when their items are ready.
                    </p>
                    <a
                      href="/settings/notifications"
                      className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium mt-2"
                    >
                      <Settings className="w-3 h-3" />
                      Set up SMS in Settings
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-stone-100" />

          {/* Customer Info */}
          <div className="bg-stone-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-stone-500">Customer</p>
                <p className="font-medium text-stone-900">{customerName || "—"}</p>
              </div>
              <div>
                <p className="text-stone-500">Item</p>
                <p className="font-medium text-stone-900">{jobType || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-700 font-medium hover:bg-stone-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : sendSms ? (
              <>
                <MessageSquare className="w-4 h-4" />
                Send SMS & Mark Ready
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Mark Ready
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
