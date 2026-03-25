"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import DOMPurify from "isomorphic-dompurify";

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

function renderMarkdown(text: string) {
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
  return DOMPurify.sanitize(html);
}

export default function SupportClient({ firstName, planName }: SupportClientProps) {
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
          content: "⚠️ I'm having trouble connecting to the support server. Please try again in a moment.",
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
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Support Header */}
      <div className="bg-[#FAF9F6] border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#071A0D] flex items-center justify-center">
             <span className="text-xl">✨</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-stone-900">Product Concierge</h2>
            <p className="text-[11px] text-stone-500 uppercase tracking-widest font-medium">Nexpura Live Support</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-stone-400 italic">"Here to help you master your jewellery business."</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {messages.length === 0 && !streamingContent ? (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <h1 className="text-2xl font-semibold text-stone-900">Hello, {firstName}</h1>
              <p className="text-stone-500 text-sm">
                I'm your Nexpura concierge. I know every corner of the dashboard and can help you with workflows, settings, or any questions you have about the platform.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                Plan: {planName}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left p-4 bg-white border border-stone-200 rounded-xl hover:border-amber-600/40 hover:bg-stone-50/50 transition-all text-sm text-stone-700 group"
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
                  <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                    <span className="text-sm">✨</span>
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#071A0D] text-white rounded-tr-sm shadow-md shadow-stone-900/10"
                    : "bg-stone-50 border border-stone-200 text-stone-900 rounded-tl-sm"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {(streamingContent || isLoading) && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                  <span className="text-sm">✨</span>
                </div>
                <div className="max-w-[85%] bg-stone-50 border border-stone-200 rounded-2xl rounded-tl-sm px-5 py-3 text-sm text-stone-900">
                  {streamingContent ? (
                    <div className="prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />
                  ) : (
                    <div className="flex items-center gap-1.5 h-5">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  )}
                  {streamingContent && <span className="inline-block w-1.5 h-3.5 bg-amber-600 animate-pulse ml-1 rounded-sm align-middle" />}
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
          <div className="relative flex items-end gap-3 bg-stone-50 border border-stone-200 rounded-2xl p-2 focus-within:border-stone-400 focus-within:ring-4 focus-within:ring-stone-900/5 transition-all">
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
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#071A0D] text-white flex items-center justify-center hover:bg-stone-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="text-center text-[10px] text-stone-400 mt-2 uppercase tracking-widest font-medium">
            Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
