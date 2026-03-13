import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { jwtVerify } from "jose";
import { config } from "./config.js";
import { handleConnection } from "./ws/handler.js";
import healthRouter from "./routes/health.js";
import { WS_PING_INTERVAL_MS } from "@clauderoulette/shared";

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(healthRouter);

const server = createServer(app);

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 /* 64KB */ });

const jwtSecret = new TextEncoder().encode(config.jwtSecret);

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const token = url.searchParams.get("token") || "";
  const isAgent = url.searchParams.get("agent") === "true";
  const sessionId = url.searchParams.get("sessionId") || undefined;

  // Verify JWT token
  if (!token) {
    ws.close(4001, "Missing authentication token");
    return;
  }

  let userId: string;
  let username: string;
  let avatarUrl: string;

  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    userId = payload.userId as string;
    username = (payload.username as string) || "anonymous";
    avatarUrl = (payload.avatarUrl as string) || "";

    if (!userId) {
      ws.close(4001, "Invalid token: missing userId");
      return;
    }
  } catch (err) {
    ws.close(4003, "Invalid or expired token");
    return;
  }

  // Mark connection as alive for ping/pong
  (ws as any)._isAlive = true;
  ws.on("pong", () => {
    (ws as any)._isAlive = true;
  });

  handleConnection(ws, {
    userId,
    username,
    avatarUrl,
    isAgent,
    sessionId,
  });
});

// Server-side ping/pong to detect dead connections
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if ((ws as any)._isAlive === false) {
      ws.terminate();
      return;
    }
    (ws as any)._isAlive = false;
    ws.ping();
  });
}, WS_PING_INTERVAL_MS);

// Clean up ping interval on server close
wss.on("close", () => {
  clearInterval(pingInterval);
});

server.listen(config.port, () => {
  console.log(`CodeRoulette server running on port ${config.port}`);
  console.log(`WebSocket server ready`);
  console.log(`Health check: http://localhost:${config.port}/health`);
});
