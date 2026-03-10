import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { handleConnection } from "./ws/handler.js";
import healthRouter from "./routes/health.js";

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(healthRouter);

const server = createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const userId = url.searchParams.get("userId") || "";
  const username = url.searchParams.get("username") || "anonymous";
  const avatarUrl = url.searchParams.get("avatarUrl") || "";
  const isAgent = url.searchParams.get("agent") === "true";
  const sessionId = url.searchParams.get("sessionId") || undefined;

  if (!userId) {
    ws.close(4001, "Missing userId");
    return;
  }

  handleConnection(ws, {
    userId,
    username,
    avatarUrl,
    isAgent,
    sessionId,
  });
});

server.listen(config.port, () => {
  console.log(`ClaudeRoulette server running on port ${config.port}`);
  console.log(`WebSocket server ready`);
  console.log(`Health check: http://localhost:${config.port}/health`);
});
