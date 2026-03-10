import type { WebSocket } from "ws";
import type { ClientEvent, AgentCommand, Role } from "@clauderoulette/shared";
import {
  getRoom,
  getRoomForUser,
  sendToMember,
  broadcastToRoom,
  sendTerminalToClients,
  createRoom,
  type RoomMember,
} from "./rooms.js";
import { addAgent, removeAgent, claimAgent } from "./agent-pool.js";
import {
  enqueue,
  removeByUserId,
  type QueueItem,
} from "../matchmaking/queue.js";
import { tryMatch, tryInviteMatch } from "../matchmaking/matcher.js";
import {
  startSession,
  endSession,
  extendSession,
  canRematch,
  swapRoles,
} from "../session/lifecycle.js";
import { handleChatMessage } from "../chat/handler.js";
import { v4 as uuid } from "uuid";

interface AuthenticatedWS extends WebSocket {
  userId?: string;
  username?: string;
  avatarUrl?: string;
  isAgent?: boolean;
  sessionId?: string;
}

export function handleConnection(ws: AuthenticatedWS, params: {
  userId: string;
  username: string;
  avatarUrl: string;
  isAgent?: boolean;
  sessionId?: string;
}): void {
  ws.userId = params.userId;
  ws.username = params.username;
  ws.avatarUrl = params.avatarUrl;
  ws.isAgent = params.isAgent || false;
  ws.sessionId = params.sessionId;

  // Host agent connection
  if (ws.isAgent) {
    if (ws.sessionId) {
      handleAgentConnection(ws, ws.sessionId);
    } else {
      // Agent joining the pool — waiting for assignment
      handlePooledAgent(ws);
    }
    return;
  }

  // Browser client connection
  ws.on("message", (rawData) => {
    try {
      const data = JSON.parse(rawData.toString()) as ClientEvent;
      handleClientMessage(ws, data);
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    handleClientDisconnect(ws);
  });
}

function handlePooledAgent(ws: AuthenticatedWS): void {
  addAgent(ws, ws.userId!);

  ws.on("close", () => {
    removeAgent(ws);
  });

  ws.send(JSON.stringify({ type: "pooled", message: "Waiting for session assignment..." }));
}

function attachAgentToRoom(ws: WebSocket, sessionId: string): void {
  const room = getRoom(sessionId);
  if (!room) return;

  room.agentWs = ws;
  console.log(`[handler] Agent attached to session ${sessionId}`);

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      sendTerminalToClients(room, data as Buffer);
    }
  });

  ws.on("close", () => {
    if (room.agentWs === ws) {
      room.agentWs = null;
      broadcastToRoom(room, {
        type: "error",
        message: "Host agent disconnected. Waiting for reconnection...",
      });
    }
  });

  // Tell agent to start the session
  const cmd: AgentCommand = { type: "start_session", sessionId };
  ws.send(JSON.stringify(cmd));

  // Start session timer if both players connected
  if (room.host && room.guest && room.startedAt === 0) {
    startSession(room);
  }
}

function handleAgentConnection(ws: AuthenticatedWS, sessionId: string): void {
  attachAgentToRoom(ws, sessionId);
}

/** Try to assign a pooled agent to a room. Returns true if successful. */
export function assignAgentToRoom(sessionId: string): boolean {
  const agent = claimAgent();
  if (!agent) return false;
  attachAgentToRoom(agent.ws, sessionId);
  return true;
}

function handleClientMessage(ws: AuthenticatedWS, event: ClientEvent): void {
  const userId = ws.userId!;

  switch (event.type) {
    case "join_queue": {
      const item: QueueItem = {
        userId,
        username: ws.username!,
        avatarUrl: ws.avatarUrl!,
        hostEligible: event.hostEligible,
        latencyMs: 0,
        joinedAt: Date.now(),
        inviteCode: event.inviteCode,
        ws,
      };

      if (event.inviteCode) {
        const match = tryInviteMatch(item, event.inviteCode);
        if (!match) {
          enqueue(item);
          ws.send(JSON.stringify({ type: "queue_joined", position: 0 }));
        }
      } else {
        const position = enqueue(item);
        ws.send(JSON.stringify({ type: "queue_joined", position }));
        tryMatch();
      }
      break;
    }

    case "leave_queue": {
      removeByUserId(userId);
      break;
    }

    case "prompt": {
      const room = getRoomForUser(userId);
      if (!room) return;

      if (room.driverId !== userId) {
        sendToMember(
          room.host?.userId === userId ? room.host! : room.guest!,
          { type: "error", message: "Only the driver can send prompts" }
        );
        return;
      }

      if (room.agentWs && room.agentWs.readyState === room.agentWs.OPEN) {
        room.agentWs.send(
          JSON.stringify({ type: "send_prompt", text: event.text } satisfies AgentCommand)
        );
      }
      break;
    }

    case "chat": {
      const room = getRoomForUser(userId);
      if (!room) return;
      handleChatMessage(room, userId, event.text);
      break;
    }

    case "request_role_swap": {
      const room = getRoomForUser(userId);
      if (!room) return;
      const other = room.host?.userId === userId ? room.guest : room.host;
      if (other) {
        sendToMember(other, { type: "role_swap_requested", by: ws.username! });
      }
      break;
    }

    case "confirm_role_swap": {
      const room = getRoomForUser(userId);
      if (!room) return;
      if (event.accepted) swapRoles(room);
      break;
    }

    case "request_rematch": {
      const room = getRoomForUser(userId);
      if (!room) return;
      if (canRematch(room)) endSession(room, "rematch");
      break;
    }

    case "request_extend": {
      const room = getRoomForUser(userId);
      if (!room) return;
      const other = room.host?.userId === userId ? room.guest : room.host;
      if (other) {
        sendToMember(other, { type: "extend_requested", by: ws.username! });
      }
      break;
    }

    case "confirm_extend": {
      const room = getRoomForUser(userId);
      if (!room) return;
      if (event.accepted) extendSession(room);
      break;
    }

    case "checkin_response": {
      const room = getRoomForUser(userId);
      if (!room) return;
      if (!event.continueSession) endSession(room, "checkin_declined");
      break;
    }

    case "solo_session": {
      const sessionId = uuid();
      const room = createRoom(sessionId);
      room.driverId = userId;

      const member: RoomMember = {
        ws,
        userId,
        username: ws.username!,
        avatarUrl: ws.avatarUrl!,
        githubId: 0,
        role: "driver",
        isHost: true,
      };
      room.host = member;
      // Set self as guest too so session lifecycle works
      room.guest = { ...member, isHost: false };

      ws.send(JSON.stringify({
        type: "matched",
        sessionId,
        partner: { username: "Claude", avatarUrl: "", githubId: 0 },
        role: "driver" as Role,
        isHost: true,
      }));

      const assigned = assignAgentToRoom(sessionId);
      if (!assigned) {
        ws.send(JSON.stringify({
          type: "error",
          message: "No host agent available. Run: npm run demo:agent",
        }));
      }
      break;
    }

    case "ping": {
      ws.send(JSON.stringify({ type: "pong" }));
      break;
    }
  }
}

function handleClientDisconnect(ws: AuthenticatedWS): void {
  const userId = ws.userId!;
  removeByUserId(userId);

  const room = getRoomForUser(userId);
  if (room) {
    broadcastToRoom(room, { type: "partner_left" });
    endSession(room, "partner_left");
  }
}
