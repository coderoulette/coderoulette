import WebSocket from "ws";
import type { AgentCommand } from "@clauderoulette/shared";

export interface WsClientOptions {
  serverUrl: string;
  userId: string;
  username: string;
  avatarUrl: string;
  sessionId?: string;
  onCommand: (command: AgentCommand) => void;
  onOpen: () => void;
  onClose: () => void;
}

export function connectToRelay(options: WsClientOptions): {
  send: (data: Buffer) => void;
  close: () => void;
} {
  const url = new URL(options.serverUrl);
  url.searchParams.set("userId", options.userId);
  url.searchParams.set("username", options.username);
  url.searchParams.set("avatarUrl", options.avatarUrl);
  url.searchParams.set("agent", "true");
  if (options.sessionId) {
    url.searchParams.set("sessionId", options.sessionId);
  }

  let ws: WebSocket;
  let reconnecting = false;
  let intentionalClose = false;

  function connect() {
    ws = new WebSocket(url.toString());

    ws.on("open", () => {
      reconnecting = false;
      options.onOpen();
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Handle both AgentCommand and info messages
        if (msg.type === "pooled") {
          // Info message, agent is in the pool
          return;
        }
        options.onCommand(msg as AgentCommand);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      options.onClose();

      if (!intentionalClose && !reconnecting) {
        reconnecting = true;
        console.log("[ws] Reconnecting in 3s...");
        setTimeout(connect, 3000);
      }
    });

    ws.on("error", (err) => {
      console.error("[ws] Error:", err.message);
    });
  }

  connect();

  return {
    send(data: Buffer) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    },
    close() {
      intentionalClose = true;
      ws.close();
    },
  };
}
