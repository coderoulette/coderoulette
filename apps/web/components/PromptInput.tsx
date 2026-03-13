"use client";

import { useState, useEffect, useRef } from "react";
import { checkPromptSafety } from "@clauderoulette/shared";

interface PromptInputProps {
  onSubmit: (text: string) => void;
  isDriver: boolean;
  disabled?: boolean;
  driverInput?: string;
}

export function PromptInput({ onSubmit, isDriver, disabled, driverInput }: PromptInputProps) {
  const [input, setInput] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [edited, setEdited] = useState(false);
  const prevDriverInputRef = useRef("");

  // Sync driver's typing into the navigator's input (until navigator edits it)
  useEffect(() => {
    if (driverInput !== undefined && !edited) {
      setInput(driverInput);
    }
    // When driver clears (submitted), reset edited state so next prompt syncs again
    if (driverInput === "" && prevDriverInputRef.current !== "") {
      setEdited(false);
      setInput("");
    }
    prevDriverInputRef.current = driverInput ?? "";
  }, [driverInput, edited]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const promptWarnings = checkPromptSafety(text);
    if (promptWarnings.length > 0 && !showWarning) {
      setWarnings(promptWarnings);
      setShowWarning(true);
      return;
    }

    onSubmit(text);
    setInput("");
    setEdited(false);
    setWarnings([]);
    setShowWarning(false);
  }

  if (!isDriver) {
    const hasDriverText = driverInput !== undefined && driverInput.length > 0;
    return (
      <div className="bg-surface border-t border-white/[0.04]">
        {hasDriverText && !edited && (
          <div className="px-4 pt-2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-[11px] text-zinc-500">Driver is typing...</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="p-3 flex gap-2.5 items-end">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); setEdited(true); }}
              disabled={disabled}
              placeholder="Suggest a prompt for the driver..."
              rows={2}
              className="w-full px-4 py-3 bg-surface-raised text-[13px] text-zinc-200 placeholder-zinc-600 rounded-xl border border-accent-violet/20 focus:border-accent-violet/40 focus:ring-1 focus:ring-accent-violet/20 focus:outline-none resize-none transition-all font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="h-10 px-5 bg-accent-violet hover:bg-accent-violet/80 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[13px] font-semibold rounded-xl transition-all"
          >
            Suggest
          </button>
        </form>
      </div>
    );
  }

  // Driver prompt (used in offline/demo mode only now)
  return (
    <div className="bg-surface border-t border-white/[0.04]">
      {showWarning && warnings.length > 0 && (
        <div className="px-5 py-2.5 bg-amber-500/[0.06] border-b border-amber-500/10">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div>
              <p className="text-[12px] text-amber-400 font-medium">Sensitive path detected</p>
              <p className="text-[11px] text-amber-400/60 mt-0.5">Press Send again to confirm.</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 flex gap-2.5 items-end">
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setShowWarning(false); }}
            disabled={disabled}
            placeholder="Send a prompt to Claude..."
            rows={2}
            className="w-full px-4 py-3 bg-surface-raised text-[13px] text-zinc-200 placeholder-zinc-600 rounded-xl border border-white/[0.04] focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20 focus:outline-none resize-none transition-all font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="h-10 px-5 bg-brand-500 hover:bg-brand-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[13px] font-semibold rounded-xl transition-all glow-brand disabled:shadow-none"
        >
          Send
        </button>
      </form>
    </div>
  );
}
