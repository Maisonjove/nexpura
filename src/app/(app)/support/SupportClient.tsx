"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SparklesIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

// Lazy-load isomorphic-dompurify on the client to avoid React #419
// (cacheComponents prerender flake from jsdom init at module load).
// Group 12 root-cause: importing isomorphic-dompurify at "use client"
// module top still gets evaluated server-side during the SSR pass,
// jsdom init blows the prerender deadline, server render errors,
// React falls back to client rendering = error #419. Lazy-loading
// inside useEffect means the module never loads on the SSR pass.
type Sanitizer = (html: string) => string;
function useDomPurify(): Sanitizer | null {
  const [sanitize, setSanitize] = useState<Sanitizer | null>(null);
  useEffect(() => {
    let alive = true;
    import("isomorphic-dompurify").then(({ default: DP }) => {
      if (alive) setSanitize(() => (s: string) => DP.sanitize(s));
    });
    return () => { alive = false; };
  }, []);
  return sanitize;
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

interface SupportClientProps {
  firstName: string;
  planName: string;
}

const SUGGESTED_QUESTIONS = [
  "How does the migration hub work?",
  "How do I create a new repair job?",
  "How do I add another team member?",
  "Can I connect my Shopify store?",
  "How do I print invoices?",
  "Talk to a live agent",
];

function renderMarkdown(text: string, sanitize: Sanitizer | null) {
  // Simple markdown renderer matching AI Copilot style
  text = text.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-stone-900 mt-3 mb-1">$1</h3>');
  text = text.replace(/^## (.+)$/gm, '<h2 class="font-semibold text-lg font-semibold text-stone-900 mt-4 mb-2">$1</h2>');
  text = text.replace(/^# (.+)$/gm, '<h1 class="font-semibold text-xl font-semibold text-stone-900 mt-4 mb-2">$1</h1>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-stone-900">$1</strong>');
  text = text.replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc text-stone-900/80">$1</li>');
  text = text.replace(/(<li[^>]*>.*<\/li>\n?)+/gm, '<ul class="space-y-1 my-2">$&</ul>');
  text = text.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-stone-900/80">$1</li>');
  text = text.replace(/\n\n/g, '</p><p class="mb-2">');
  text = text.replace(/\n/g, '<br/>');
  const html = `<p class="mb-2">${text}</p>`;
  return sanitize ? sanitize(html) : "";
}

export default function SupportClient({ firstName, planName }: SupportClientProps) {
  const sanitize = useDomPurify();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = messageText ?? input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setStreamingContent(fullContent);
        }
      }

      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, role: "assistant", content: fullContent },
      ]);
      setStreamingContent("");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "I'm having trouble connecting to the support server. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white border border-stone-200 rounded-2xl overflow-hidden">
      {/* Support Header */}
      <div className="bg-nexpura-ivory border-b border-stone-200 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SparklesIcon className="w-6 h-6 text-nexpura-bronze" strokeWidth={1.5} />
          <div>
            <p className="text-[0.6875rem] tracking-luxury uppercase text-stone-400 mb-0.5">Support</p>
            <h2 className="font-serif text-xl tracking-tight text-stone-900 leading-none">Concierge</h2>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[0.75rem] text-stone-400 italic">Here to help you master your jewellery business.</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {messages.length === 0 && !streamingContent ? (
          <div className="max-w-2xl mx-auto space-y-10">
            <div className="text-center space-y-4">
              <p className="text-[0.6875rem] tracking-luxury uppercase text-stone-400">Welcome</p>
              <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-stone-900">Hello, {firstName}</h1>
              <p className="text-stone-500 text-[0.9375rem] leading-relaxed max-w-md mx-auto">
                I&apos;m your Nexpura concierge. I know every corner of the dashboard and can help you with workflows, settings, or any questions you have about the platform.
              </p>
              <span className="nx-badge-neutral inline-flex">
                {planName}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left p-5 bg-white border border-stone-200 rounded-2xl hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 text-sm text-stone-700 group"
                >
                  <span className="block font-medium group-hover:text-stone-900">{q}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <SparklesIcon className="w-5 h-5 text-nexpura-bronze flex-shrink-0 mr-3 mt-2" strokeWidth={1.5} />
                )}
                <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-nexpura-charcoal text-white rounded-tr-sm"
                    : "bg-stone-50 border border-stone-200 text-stone-900 rounded-tl-sm"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content, sanitize) }} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {(streamingContent || isLoading) && (
              <div className="flex justify-start">
                <SparklesIcon className="w-5 h-5 text-nexpura-bronze flex-shrink-0 mr-3 mt-2" strokeWidth={1.5} />
                <div className="max-w-[85%] bg-stone-50 border border-stone-200 rounded-2xl rounded-tl-sm px-5 py-3 text-sm text-stone-900">
                  {streamingContent ? (
                    <div className="prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent, sanitize) }} />
                  ) : (
                    <div className="flex items-center gap-1.5 h-5">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  )}
                  {streamingContent && <span className="inline-block w-1.5 h-3.5 bg-nexpura-bronze animate-pulse ml-1 rounded-sm align-middle" />}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-stone-200">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-3 bg-white border border-stone-200 rounded-2xl p-2 focus-within:border-nexpura-bronze focus-within:ring-2 focus-within:ring-nexpura-bronze/20 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the Nexpura concierge anything..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-stone-900 placeholder-stone-400 resize-none outline-none px-3 py-2 max-h-40 min-h-[40px]"
              style={{ height: "auto" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-nexpura-charcoal text-white flex items-center justify-center hover:bg-stone-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowRightIcon className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
          <p className="text-center text-[10px] text-stone-400 mt-3 tracking-luxury uppercase">
            Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
