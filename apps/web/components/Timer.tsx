"use client";

import { useTimer } from "@/hooks/useTimer";

interface TimerProps {
  endsAt: string | null;
  extended: boolean;
  onRequestExtend: () => void;
}

export function Timer({ endsAt, extended, onRequestExtend }: TimerProps) {
  const { display, isWarning, remainingMs } = useTimer(endsAt);

  if (!endsAt) return null;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`font-mono text-[13px] font-semibold tabular-nums px-2.5 py-1 rounded-lg transition-colors ${
          isWarning
            ? "bg-red-500/10 text-red-400 border border-red-500/20"
            : "text-zinc-400"
        }`}
      >
        {display}
      </div>

      {!extended && remainingMs > 0 && remainingMs < 10 * 60 * 1000 && (
        <button
          onClick={onRequestExtend}
          className="text-[11px] text-accent-emerald hover:text-accent-emerald/80 font-medium transition-colors"
        >
          +15m
        </button>
      )}
    </div>
  );
}
