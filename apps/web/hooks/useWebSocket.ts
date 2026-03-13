"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientEvent, ServerEvent } from "@clauderoulette/shared";
import { buildWsUrl } from "@/lib/ws";

interface UseWebSocketOptions {
  enabled: boolean;
  onMessage: (event: ServerEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

export function useWebSocket({
  enabled,
  onMessage,
  onOpen,
  onClose,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  onMessageRef.current = onMessage;
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    intentionalCloseRef.current = false;

    async function connect() {
      try {
        const url = await buildWsUrl();
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          reconnectAttemptRef.current = 0;
          onOpenRef.current?.();
        };

        ws.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data) as ServerEvent;
            onMessageRef.current(event);
          } catch {
            // Ignore malformed messages
          }
        };

        ws.onclose = () => {
          setConnected(false);
          onCloseRef.current?.();

          if (!intentionalCloseRef.current) {
            const delay = Math.min(
              BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
              MAX_RECONNECT_DELAY
            );
            reconnectAttemptRef.current++;
            reconnectTimerRef.current = setTimeout(connect, delay);
          }
        };
      } catch (err) {
        console.error("[useWebSocket] Failed to connect:", err);
        // Retry on token fetch failure
        if (!intentionalCloseRef.current) {
          const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY
          );
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      }
    }

    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 15000);

    return () => {
      intentionalCloseRef.current = true;
      clearInterval(pingInterval);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [enabled]);

  const send = useCallback((event: ClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  return { send, connected };
}
