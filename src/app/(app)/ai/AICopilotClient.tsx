"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Conversation = {
  id: string;
  title: string | null;
  updated_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

interface Props {
  conversations: Conversation[];
  plan: string;
}

const SUGGESTED_PROMPTS = [
  "How is my business performing this month?",
  "Which customers haven't visited in 3+ months?",
  "What's my average job turnaround time?",
  "Give me tips to improve my bespoke pricing",
  "Summarise my outstanding invoices",
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function renderMarkdown(text: string) {
  // Handle headings
  text = text.replace(/^### (.+)$/gm, '<h3 class="font-fraunces text-base font-semibold text-forest mt-3 mb-1">$1</h3>');
  text = text.replace(/^## (.+)$/gm, '<h2 class="font-fraunces text-lg font-semibold text-forest mt-4 mb-2">$1</h2>');
  text = text.replace(/^# (.+)$/gm, '<h1 class="font-fraunces text-xl font-semibold text-forest mt-4 mb-2">$1</h1>');
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-forest">$1</strong>');
  // Bullet lists
  text = text.replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc text-forest/80">$1</li>');
  text = text.replace(/(<li[^>]*>.*<\/li>\n?)+/gm, '<ul class="space-y-1 my-2">$&</ul>');
  // Numbered lists
  text = text.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-forest/80">$1</li>');
  // Line breaks
  text = text.replace(/\n\n/g, '</p><p class="mb-2">');
  text = text.replace(/\n/g, '<br/>');
  return `<p class="mb-2">${text}</p>`;
}

export default function AICopilotClient({ conversations: initialConversations, plan }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function loadConversation(convoId: string) {
    setActiveConvoId(convoId);
    setMessages([]);
    setStreamingContent("");

    try {
      const res = await fetch(`/api/ai/conversations/${convoId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch {
      // If we can't load history, just show empty
    }
  }

  function newConversation() {
    setActiveConvoId(null);
    setMessages([]);
    setStreamingContent("");
    inputRef.current?.focus();
  }

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
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: activeConvoId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Something went wrong" }));
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `⚠️ ${err.error || "Something went wrong. Please try again."}`,
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Get conversation ID from header
      const newConvoId = res.headers.get("X-Conversation-Id");
      if (newConvoId && !activeConvoId) {
        setActiveConvoId(newConvoId);
        // Add to conversation list
        setConversations((prev) => [
          { id: newConvoId, title: text.slice(0, 80), updated_at: new Date().toISOString() },
          ...prev,
        ]);
      }

      // Stream the response (plain text stream)
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
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: fullContent,
        },
      ]);
      setStreamingContent("");
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "⚠️ Connection error. Please check your internet and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeConvoId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const isEmpty = messages.length === 0 && !streamingContent;

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      {/* Left sidebar — conversations */}
      <div className={`flex-shrink-0 bg-white border-r border-platinum flex flex-col transition-all duration-200 ${sidebarOpen ? "w-64" : "w-0 overflow-hidden"}`}>
        <div className="p-4 border-b border-platinum">
          <button
            onClick={newConversation}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <p className="px-4 py-6 text-xs text-forest/40 text-center">
              No conversations yet
            </p>
          ) : (
            conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => loadConversation(convo.id)}
                className={`w-full text-left px-4 py-3 hover:bg-ivory transition-colors group ${
                  activeConvoId === convo.id ? "bg-sage/10 border-r-2 border-sage" : ""
                }`}
              >
                <p className={`text-sm truncate ${activeConvoId === convo.id ? "text-forest font-medium" : "text-forest/70"}`}>
                  {convo.title || "New conversation"}
                </p>
                <p className="text-xs text-forest/30 mt-0.5">
                  {timeAgo(convo.updated_at)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-ivory">
        {/* Chat header */}
        <div className="bg-white border-b border-platinum px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-1.5 rounded-lg hover:bg-ivory text-forest/40 hover:text-forest transition-colors"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sage/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-forest font-fraunces">AI Business Copilot</p>
              <p className="text-xs text-forest/40 capitalize">{plan} plan · Powered by Claude</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {isEmpty ? (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8 mt-8">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-sage/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="font-fraunces text-xl font-semibold text-forest">
                  How can I help your business today?
                </h2>
                <p className="text-forest/50 text-sm mt-2">
                  Ask me anything about your jewellery business.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left p-4 bg-white rounded-xl border border-platinum hover:border-sage/40 hover:shadow-sm transition-all text-sm text-forest/70 hover:text-forest"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-sage/15 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                      <svg className="w-4 h-4 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-sage text-white rounded-tr-sm"
                        : "bg-white border border-platinum text-forest rounded-tl-sm shadow-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div
                        className="prose-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming message */}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-lg bg-sage/15 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <svg className="w-4 h-4 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="max-w-[75%] bg-white border border-platinum rounded-2xl rounded-tl-sm shadow-sm px-4 py-3 text-sm text-forest">
                    <div
                      className="prose-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }}
                    />
                    <span className="inline-block w-1.5 h-3.5 bg-sage animate-pulse ml-0.5 rounded-sm" />
                  </div>
                </div>
              )}

              {/* Loading dots */}
              {isLoading && !streamingContent && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-lg bg-sage/15 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <svg className="w-4 h-4 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="bg-white border border-platinum rounded-2xl rounded-tl-sm shadow-sm px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-sage/40 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-sage/40 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-sage/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-platinum p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-ivory border border-platinum rounded-xl p-2 focus-within:border-sage transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your jewellery business…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-forest placeholder-forest/30 resize-none outline-none px-2 py-1 max-h-32 min-h-[36px]"
                style={{ height: "auto" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-9 h-9 rounded-lg bg-sage text-white flex items-center justify-center hover:bg-sage/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-forest/25 mt-2">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
