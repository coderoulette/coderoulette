"use client";

interface RoleSwapButtonProps {
  isDriver: boolean;
  swapRequested: boolean;
  swapRequestedBy?: string;
  onRequestSwap: () => void;
  onConfirmSwap: (accepted: boolean) => void;
}

export function RoleSwapButton({
  isDriver,
  swapRequested,
  swapRequestedBy,
  onRequestSwap,
  onConfirmSwap,
}: RoleSwapButtonProps) {
  if (swapRequested && swapRequestedBy) {
    return (
      <div className="flex items-center gap-2 animate-scale-in">
        <span className="text-[12px] text-zinc-400">
          <span className="font-medium text-zinc-200">{swapRequestedBy}</span> wants to drive
        </span>
        <button
          onClick={() => onConfirmSwap(true)}
          className="px-2.5 py-1 text-[11px] font-medium bg-accent-emerald/10 text-accent-emerald rounded-md hover:bg-accent-emerald/20 transition-colors"
        >
          Allow
        </button>
        <button
          onClick={() => onConfirmSwap(false)}
          className="px-2.5 py-1 text-[11px] font-medium bg-surface-overlay text-zinc-500 rounded-md hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
        >
          Decline
        </button>
      </div>
    );
  }

  if (!isDriver) {
    return (
      <button
        onClick={onRequestSwap}
        className="flex items-center gap-1.5 text-[12px] text-zinc-600 hover:text-zinc-300 transition-colors group"
      >
        <svg className="w-3.5 h-3.5 group-hover:text-accent-violet transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
        Request to drive
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
      <span className="text-[12px] text-brand-400 font-medium">Driving</span>
    </div>
  );
}
