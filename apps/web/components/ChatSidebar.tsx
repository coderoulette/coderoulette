"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@clauderoulette/shared";

interface ChatSidebarProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  partnerUsername?: string;
  onPromptClick?: (text: string) => void;
}

export function ChatSidebar({
  messages,
  onSend,
  partnerUsername,
  onPromptClick,
}: ChatSidebarProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only auto-scroll if user is near the bottom (within 100px)
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  }

  return (
    <div className="flex flex-col h-full bg-surface border-l border-white/[0.04]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
          <h3 className="text-[13px] font-semibold text-zinc-200">Chat</h3>
        </div>
        {partnerUsername && (
          <p className="text-[11px] text-zinc-600 mt-0.5 ml-3.5">
            with {partnerUsername}
          </p>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-surface-raised flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <p className="text-[13px] text-zinc-600 leading-relaxed">
              Discuss what to build, share ideas, or just say hi
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="animate-slide-up">
            <div className="flex items-start gap-2.5">
              <img
                src={msg.avatarUrl}
                alt={msg.username}
                className="w-6 h-6 rounded-full mt-0.5 ring-1 ring-white/[0.06]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold text-zinc-300">
                    {msg.username}
                  </span>
                  <span className="text-[10px] text-zinc-700">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {msg.text.startsWith("💡 Prompt suggestion:") && onPromptClick ? (
                  <button
                    onClick={() => onPromptClick(msg.text.replace("💡 Prompt suggestion: ", ""))}
                    className="text-left text-[13px] mt-0.5 leading-relaxed break-words px-2.5 py-1.5 rounded-lg bg-accent-violet/10 border border-accent-violet/20 text-accent-violet hover:bg-accent-violet/20 transition-colors w-full group"
                  >
                    <span className="text-[11px] text-accent-violet/60 block mb-0.5">Click to type suggestion</span>
                    {msg.text.replace("💡 Prompt suggestion: ", "")}
                  </button>
                ) : (
                  <p className="text-[13px] text-zinc-400 mt-0.5 leading-relaxed break-words">
                    {msg.text}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/[0.04]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message..."
            className="flex-1 px-3 py-2 bg-surface-raised text-[13px] text-zinc-200 placeholder-zinc-700 rounded-lg border border-white/[0.04] focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20 focus:outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-3 py-2 bg-surface-raised hover:bg-surface-overlay disabled:opacity-30 text-zinc-400 hover:text-zinc-200 rounded-lg border border-white/[0.04] transition-all disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
