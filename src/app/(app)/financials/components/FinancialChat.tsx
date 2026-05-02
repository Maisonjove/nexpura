'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import type { ChatMessage } from './types';

const EXAMPLE_PROMPTS = [
  "What's my best selling category?",
  "How much GST do I owe?",
  "Which customers spend the most?",
  "What are my slowest moving items?",
];

export default function FinancialChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg].slice(-10);
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch('/api/ai/financial-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!res.ok || !res.body) throw new Error('Failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: current };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-200">
        <h2 className="font-semibold text-stone-900">Ask Your Finances</h2>
        <p className="text-xs text-stone-400 mt-0.5">Ask anything about your financial data</p>
      </div>
      {messages.length === 0 && (
        <div className="px-6 pt-4 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="text-xs px-3 py-1.5 rounded-full border border-stone-200 text-stone-600 hover:border-amber-600 hover:text-amber-700 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {messages.length > 0 && (
        <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-nexpura-charcoal text-white rounded-br-sm'
                  : 'bg-stone-100 text-stone-800 rounded-bl-sm'
              }`}>
                {m.content || (streaming && i === messages.length - 1 ? <span className="animate-pulse">…</span> : '')}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
      <div className="px-6 py-4 border-t border-stone-100">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your finances…"
            disabled={streaming}
            className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-2 outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze/20 disabled:opacity-50 placeholder:text-stone-400"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-3 py-2 bg-nexpura-charcoal text-white rounded-lg hover:bg-[#7a6447] transition-colors disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
