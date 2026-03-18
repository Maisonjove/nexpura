"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Phone,
  Key,
  User,
  Sparkles,
  AlertCircle,
  Copy,
  CheckCircle,
} from "lucide-react";
import { saveTwilioCredentials, testTwilioConnection } from "./twilio-actions";

interface Props {
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: "Create Account", icon: User },
  { id: 2, title: "Get Credentials", icon: Key },
  { id: 3, title: "Get Phone Number", icon: Phone },
  { id: 4, title: "Enter Details", icon: MessageSquare },
  { id: 5, title: "Success!", icon: Sparkles },
];

export default function TwilioSetupWizard({ onComplete }: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [credentials, setCredentials] = useState({
    account_sid: "",
    auth_token: "",
    phone_number: "",
  });

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleTestConnection() {
    if (!credentials.account_sid || !credentials.auth_token) {
      setTestResult({ success: false, message: "Please enter your Account SID and Auth Token" });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const result = await testTwilioConnection(credentials.account_sid, credentials.auth_token);
    setTestResult(result);
    setTesting(false);
  }

  async function handleSaveCredentials() {
    if (!credentials.account_sid || !credentials.auth_token || !credentials.phone_number) {
      setTestResult({ success: false, message: "Please fill in all fields" });
      return;
    }

    setSaving(true);
    const result = await saveTwilioCredentials(credentials);

    if (result.error) {
      setTestResult({ success: false, message: result.error });
      setSaving(false);
      return;
    }

    setSaving(false);
    setCurrentStep(5);
  }

  function renderStep1() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-red-400" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.248 4.8c.985 0 1.784.8 1.784 1.784a1.785 1.785 0 01-3.568 0c0-.984.8-1.784 1.784-1.784zm3.768 12.672c-.36.72-1.2 1.008-1.92.648-.72-.36-1.008-1.2-.648-1.92.216-.432.648-.72 1.08-.72.264 0 .528.072.768.216.72.36 1.008 1.2.648 1.92-.072.144-.144.264-.216.384.072-.072.144-.168.216-.264-.216.432-.648.72-1.08.72-.264 0-.528-.072-.768-.216-.72-.36-1.008-1.2-.648-1.92.072-.144.144-.264.216-.384l.352-.352z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Create a Twilio Account</h2>
          <p className="text-stone-400">
            Twilio is a trusted platform that lets you send SMS messages worldwide. 
            It's used by thousands of businesses and is very affordable.
          </p>
        </div>

        <div className="bg-[#252525] rounded-xl p-6 space-y-4">
          <h3 className="font-medium text-white">📱 What is Twilio?</h3>
          <p className="text-stone-300 text-sm">
            Twilio is like a post office for text messages. You pay a small amount per message 
            (usually a few cents) and they deliver your messages reliably to your customers' phones.
          </p>
          
          <div className="border-t border-white/[0.06] pt-4">
            <h4 className="font-medium text-white mb-2">💰 Cost Estimate</h4>
            <ul className="text-stone-300 text-sm space-y-1">
              <li>• Phone number: ~$1-2/month</li>
              <li>• Per SMS: ~$0.01-0.05 depending on country</li>
              <li>• 100 messages = ~$1-5 total</li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <a
            href="https://www.twilio.com/try-twilio"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-red-500 hover:bg-red-400 text-white rounded-lg font-medium transition-colors"
          >
            Create Free Twilio Account
            <ExternalLink className="w-4 h-4" />
          </a>
          <p className="text-center text-xs text-stone-500">
            Opens in a new tab. Come back here when you're done!
          </p>
        </div>

        <button
          onClick={() => setCurrentStep(2)}
          className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
        >
          I Have an Account
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Get Your Credentials</h2>
          <p className="text-stone-400">
            We need two pieces of information from your Twilio account to connect.
          </p>
        </div>

        <div className="bg-[#252525] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="font-medium text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">1</span>
              Find Your Account SID
            </h3>
          </div>
          <div className="p-4 space-y-3">
            <ol className="text-stone-300 text-sm space-y-2">
              <li>1. Log in to your <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Twilio Console</a></li>
              <li>2. Look at the main dashboard</li>
              <li>3. Find <strong className="text-white">"Account SID"</strong> - it starts with "AC"</li>
            </ol>
            <div className="bg-[#1A1A1A] rounded-lg p-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-stone-500 mb-1">Example Account SID:</p>
                <code className="text-green-400 text-sm">ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#252525] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="font-medium text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">2</span>
              Find Your Auth Token
            </h3>
          </div>
          <div className="p-4 space-y-3">
            <ol className="text-stone-300 text-sm space-y-2">
              <li>1. On the same dashboard page</li>
              <li>2. Find <strong className="text-white">"Auth Token"</strong></li>
              <li>3. Click the eye icon to reveal it, then copy</li>
            </ol>
            <div className="bg-[#1A1A1A] rounded-lg p-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-stone-500 mb-1">Example Auth Token:</p>
                <code className="text-green-400 text-sm">xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Keep your Auth Token secret! Never share it publicly.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentStep(1)}
            className="flex items-center justify-center gap-2 px-4 py-3 text-stone-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => setCurrentStep(3)}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
          >
            I Have Both
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Get a Phone Number</h2>
          <p className="text-stone-400">
            You need a Twilio phone number to send SMS messages from.
          </p>
        </div>

        <div className="bg-[#252525] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="font-medium text-white">📞 Buy a Twilio Number</h3>
          </div>
          <div className="p-4 space-y-4">
            <ol className="text-stone-300 text-sm space-y-3">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center flex-shrink-0">1</span>
                <span>Go to <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/buy" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Buy a Number</a> in Twilio Console</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center flex-shrink-0">2</span>
                <span>Select your country (e.g., Australia, UK, USA)</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center flex-shrink-0">3</span>
                <span>Make sure <strong className="text-white">"SMS"</strong> capability is checked</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center flex-shrink-0">4</span>
                <span>Click "Buy" on any available number (~$1/month)</span>
              </li>
            </ol>

            <div className="bg-[#1A1A1A] rounded-lg p-3">
              <p className="text-xs text-stone-500 mb-1">Example number format:</p>
              <code className="text-green-400 text-sm">+61412345678</code>
              <p className="text-xs text-stone-500 mt-1">Always include the + and country code</p>
            </div>
          </div>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <h4 className="font-medium text-green-400 mb-2">💡 Pro Tip</h4>
          <p className="text-green-300 text-sm">
            Choose a local number from your country. Customers are more likely to read messages 
            from local numbers, and the cost per SMS is usually lower!
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentStep(2)}
            className="flex items-center justify-center gap-2 px-4 py-3 text-stone-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => setCurrentStep(4)}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
          >
            I Have a Number
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Enter Your Details</h2>
          <p className="text-stone-400">
            Almost done! Enter the credentials from your Twilio account.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-2">
              Account SID
            </label>
            <input
              type="text"
              value={credentials.account_sid}
              onChange={(e) => setCredentials({ ...credentials, account_sid: e.target.value })}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-3 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-300 mb-2">
              Auth Token
            </label>
            <div className="relative">
              <input
                type={showAuthToken ? "text" : "password"}
                value={credentials.auth_token}
                onChange={(e) => setCredentials({ ...credentials, auth_token: e.target.value })}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-3 pr-12 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowAuthToken(!showAuthToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
              >
                {showAuthToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-300 mb-2">
              Phone Number
            </label>
            <input
              type="text"
              value={credentials.phone_number}
              onChange={(e) => setCredentials({ ...credentials, phone_number: e.target.value })}
              placeholder="+61412345678"
              className="w-full px-4 py-3 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono text-sm"
            />
            <p className="text-xs text-stone-500 mt-1">Include + and country code</p>
          </div>
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-3 p-4 rounded-lg ${
              testResult.success
                ? "bg-green-500/10 border border-green-500/20"
                : "bg-red-500/10 border border-red-500/20"
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <p className={`text-sm ${testResult.success ? "text-green-300" : "text-red-300"}`}>
              {testResult.message}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testing || !credentials.account_sid || !credentials.auth_token}
            className="px-4 py-3 border border-white/[0.1] hover:border-white/[0.2] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </span>
            ) : (
              "Test Connection"
            )}
          </button>
          <button
            onClick={handleSaveCredentials}
            disabled={saving || !credentials.account_sid || !credentials.auth_token || !credentials.phone_number}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save & Connect
              </>
            )}
          </button>
        </div>

        <button
          onClick={() => setCurrentStep(3)}
          className="flex items-center justify-center gap-2 w-full py-2 text-stone-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    );
  }

  function renderStep5() {
    return (
      <div className="space-y-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
          <Sparkles className="w-10 h-10 text-green-400" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-2">You're All Set! 🎉</h2>
          <p className="text-stone-400">
            Twilio is now connected and ready to send SMS messages to your customers.
          </p>
        </div>

        <div className="bg-[#252525] rounded-xl p-6 text-left space-y-4">
          <h3 className="font-medium text-white">What you can do now:</h3>
          <ul className="text-stone-300 text-sm space-y-2">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              Send bulk SMS to all your customers
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              Target specific customer segments
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              Send personalized messages with customer names
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              Track message delivery status
            </li>
          </ul>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-left">
          <h4 className="font-medium text-blue-400 mb-2">📱 SMS vs WhatsApp</h4>
          <p className="text-blue-300 text-sm">
            <strong>SMS (Twilio)</strong> is for marketing messages to customers.<br />
            <strong>WhatsApp</strong> is for internal staff reminders and notifications.
          </p>
        </div>

        <button
          onClick={() => {
            onComplete();
            router.refresh();
          }}
          className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
        >
          Start Sending SMS
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress Steps */}
      {currentStep < 5 && (
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.slice(0, 4).map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  currentStep === step.id
                    ? "bg-amber-500 text-white"
                    : currentStep > step.id
                    ? "bg-green-500 text-white"
                    : "bg-stone-700 text-stone-400"
                }`}
              >
                {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
              </div>
              {index < 3 && (
                <div
                  className={`w-8 h-0.5 ${
                    currentStep > step.id ? "bg-green-500" : "bg-stone-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-2xl p-6">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </div>
    </div>
  );
}
