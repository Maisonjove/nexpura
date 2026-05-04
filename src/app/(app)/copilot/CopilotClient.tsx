"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  SparklesIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

// Lazy-load DOMPurify on the client (Group 14 carryover from Group 12).
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

interface CopilotClientProps {
  firstName: string;
  tenantId: string;
}

const SUGGESTED_QUESTIONS = [
  "How much did I sell this month?",
  "What's my best selling item?",
  "Show me my top 5 customers",
  "How many repairs are overdue?",
  "What's my average sale value?",
  "Compare this month to last month",
];

function renderMarkdown(text: string, sanitize: Sanitizer | null) {
  text = text.replace(/^### (.+)$/gm, '<h3 class="font-serif text-lg text-stone-900 mt-3 mb-1">$1</h3>');
  text = text.replace(/^## (.+)$/gm, '<h2 class="font-serif text-xl text-stone-900 mt-4 mb-2">$1</h2>');
  text = text.replace(/^# (.+)$/gm, '<h1 class="font-serif text-2xl text-stone-900 mt-4 mb-2">$1</h1>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-stone-900">$1</strong>');
  text = text.replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc text-stone-700">$1</li>');
  text = text.replace(/(<li[^>]*>.*<\/li>\n?)+/gm, '<ul class="space-y-1 my-2">$&</ul>');
  text = text.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-stone-700">$1</li>');
  text = text.replace(/\n\n/g, '</p><p class="mb-2">');
  text = text.replace(/\n/g, '<br/>');
  const html = `<p class="mb-2">${text}</p>`;
  return sanitize ? sanitize(html) : "";
}

export default function CopilotClient({ firstName, tenantId }: CopilotClientProps) {
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
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, tenantId }),
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
          content: "I'm having trouble connecting. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, tenantId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
            AI
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
            Copilot
          </h1>
          <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
            Your intelligent business insights assistant. Ask anything about your sales, customers, or operations.
          </p>
        </div>

        {/* Chat Panel */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-22rem)] min-h-[520px]">
          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-10">
            {messages.length === 0 && !streamingContent ? (
              <div className="max-w-2xl mx-auto space-y-10">
                <div className="text-center space-y-4">
                  <SparklesIcon className="w-8 h-8 text-stone-300 mx-auto" />
                  <h2 className="font-serif text-3xl text-stone-900 tracking-tight">
                    Hello {firstName}
                  </h2>
                  <p className="text-stone-500 text-sm leading-relaxed max-w-md mx-auto">
                    Ask about your sales, identify trends, find your best customers, track repairs, and more.
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-4 text-center">
                    Suggested questions
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-left p-4 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 text-sm text-stone-700 group"
                      >
                        <span className="block group-hover:text-stone-900">{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-5">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-stone-100 text-stone-900 rounded-tr-sm"
                          : "bg-white border border-stone-200 text-stone-900 rounded-tl-sm"
                      }`}
                    >
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
                    <div className="max-w-[85%] bg-white border border-stone-200 rounded-2xl rounded-tl-sm px-5 py-3 text-sm text-stone-900">
                      {streamingContent ? (
                        <div className="prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent, sanitize) }} />
                      ) : (
                        <div className="flex items-center gap-1.5 h-5">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0.4s]" />
                        </div>
                      )}
                      {streamingContent && (
                        <span className="inline-block w-1.5 h-3.5 bg-nexpura-bronze animate-pulse ml-1 rounded-sm align-middle" />
                      )}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="px-6 sm:px-10 py-5 border-t border-stone-200 bg-white">
            <div className="max-w-3xl mx-auto">
              <div className="relative flex items-end gap-3 bg-white border border-stone-200 rounded-2xl p-2 focus-within:border-nexpura-bronze focus-within:ring-2 focus-within:ring-nexpura-bronze/20 transition-all duration-200">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your business..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 resize-none outline-none px-3 py-2 max-h-40 min-h-[40px]"
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
                  className="nx-btn-primary inline-flex items-center justify-center !px-3 !py-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <PaperAirplaneIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-center text-[10px] text-stone-400 mt-3 uppercase tracking-luxury">
                Shift + Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
