"use client";

import { useState, useEffect, useCallback } from "react";

export function useTimer(endsAt: string | null) {
  const [remainingMs, setRemainingMs] = useState<number>(0);

  useEffect(() => {
    if (!endsAt) return;

    const update = () => {
      const remaining = new Date(endsAt).getTime() - Date.now();
      setRemainingMs(Math.max(0, remaining));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const display = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const isWarning = remainingMs > 0 && remainingMs <= 5 * 60 * 1000;
  const isExpired = endsAt !== null && remainingMs <= 0;

  return { remainingMs, display, isWarning, isExpired };
}
