"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientEvent, ServerEvent } from "@clauderoulette/shared";
import { buildWsUrl } from "@/lib/ws";

interface UseWebSocketOptions {
  userId: string;
  username: string;
  avatarUrl: string;
  onMessage: (event: ServerEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useWebSocket({
  userId,
  username,
  avatarUrl,
  onMessage,
  onOpen,
  onClose,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const url = buildWsUrl({ userId, username, avatarUrl });
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      onOpen?.();
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ServerEvent;
        onMessage(event);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      onClose?.();
    };

    // Ping every 15s
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [userId, username, avatarUrl]);

  const send = useCallback((event: ClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  return { send, connected };
}
