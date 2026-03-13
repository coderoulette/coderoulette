import type { WebSocket } from "ws";
import type { ClientEvent, AgentCommand, Role, ServerEvent } from "@clauderoulette/shared";
import {
  getRoom,
  getRoomForUser,
  sendToMember,
  broadcastToRoom,
  sendTerminalToClients,
  createRoom,
  indexUserToRoom,
  type RoomMember,
} from "./rooms.js";
import { RECONNECT_GRACE_MS } from "@clauderoulette/shared";
import { addAgent, removeAgent, claimAgentForUser } from "./agent-pool.js";
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
    } else {
      // Agent may send terminal data as text (UTF-8)
      const str = data.toString();
      if (!str.startsWith("{")) {
        sendTerminalToClients(room, Buffer.from(str, "utf-8"));
      }
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

/** Try to assign a user's agent to a room. Returns true if successful. */
export function assignAgentToRoom(sessionId: string, hostUserId: string): boolean {
  const agent = claimAgentForUser(hostUserId);
  if (!agent) return false;
  attachAgentToRoom(agent.ws, sessionId);
  return true;
}

function handleClientMessage(ws: AuthenticatedWS, event: ClientEvent): void {
  const userId = ws.userId!;
  const wsPort = (ws as any)._socket?.remotePort || "?";
  if (event.type !== "ping") {
    console.log(`[handler] msg from user=${userId} port=${wsPort} type=${event.type}`);
  }

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

      if (room.driverWs !== ws) {
        const me = room.host?.ws === ws ? room.host! : room.guest!;
        sendToMember(me, { type: "error", message: "Only the driver can send prompts" });
        return;
      }

      // Validate prompt size
      if (!event.text || event.text.length > 10_000) return;

      if (room.agentWs && room.agentWs.readyState === room.agentWs.OPEN) {
        room.agentWs.send(
          JSON.stringify({ type: "send_prompt", text: event.text } satisfies AgentCommand)
        );
      }
      break;
    }

    case "terminal_input": {
      const room = getRoomForUser(userId);
      if (!room) return;
      if (room.driverWs !== ws) {
        const wsPort = (ws as any)._socket?.remotePort || "?";
        const driverPort = (room.driverWs as any)?._socket?.remotePort || "?";
        const hostPort = (room.host?.ws as any)?._socket?.remotePort || "?";
        const guestPort = (room.guest?.ws as any)?._socket?.remotePort || "?";
        console.log(`[handler] terminal_input REJECTED: user=${userId} wsPort=${wsPort} driverWsPort=${driverPort} hostPort=${hostPort} guestPort=${guestPort} hostRole=${room.host?.role} guestRole=${room.guest?.role}`);
        return;
      }

      // Validate input size
      if (!event.data || event.data.length > 1_000) return;

      const isNonHostDriver = room.hostWs !== null && room.hostWs !== ws;
      const hostWsPort = (room.hostWs as any)?._socket?.remotePort || "?";
      const wsPort2 = (ws as any)._socket?.remotePort || "?";
      if (isNonHostDriver) {
        console.log(`[handler] non-host driver input: data=${JSON.stringify(event.data)} hostWs=${hostWsPort} ws=${wsPort2}`);
      }

      // Non-host driver: intercept Enter for host approval
      if (isNonHostDriver && event.data === "\r") {
        const enterId = uuid().slice(0, 8);
        room.pendingPrompts.set(`enter:${enterId}`, "\r");
        // Notify host for approval
        const hostMember = room.hostWs === room.host?.ws ? room.host : room.guest;
        if (hostMember) {
          sendToMember(hostMember, {
            type: "prompt_approval",
            id: `enter:${enterId}`,
            text: room.driverInputBuffer || "(Enter)",
            from: ws.username!,
          });
        }
        // Don't forward Enter to agent — wait for approval
        // Still mirror to navigator
        const me2 = room.host?.ws === ws ? room.host : room.guest;
        const nav = me2 === room.host ? room.guest : room.host;
        if (nav && nav.ws !== ws) {
          sendToMember(nav, { type: "driver_input", data: event.data });
        }
        return;
      }

      // Track input buffer for non-host driver (for display in approval prompt)
      if (isNonHostDriver) {
        const d = event.data;
        if (d === "\x7f" || d === "\b") {
          room.driverInputBuffer = room.driverInputBuffer.slice(0, -1);
        } else if (d === "\x15") {
          // Ctrl+U: clear line
          room.driverInputBuffer = "";
        } else if (!d.startsWith("\x1b") && d.length === 1 && d.charCodeAt(0) >= 32) {
          room.driverInputBuffer += d;
        }
      }

      if (room.agentWs && room.agentWs.readyState === room.agentWs.OPEN) {
        room.agentWs.send(
          JSON.stringify({ type: "terminal_input", data: event.data } satisfies AgentCommand)
        );
      }
      // Forward driver's input to navigator so they can see what's being typed
      const me = room.host?.ws === ws ? room.host : room.guest;
      const navigator = me === room.host ? room.guest : room.host;
      if (navigator && navigator.ws !== ws) {
        sendToMember(navigator, { type: "driver_input", data: event.data });
      }
      break;
    }

    case "resize": {
      const room = getRoomForUser(userId);
      if (!room) return;
      // Only the driver controls the PTY dimensions
      if (room.driverWs !== ws) break;
      if (room.agentWs && room.agentWs.readyState === room.agentWs.OPEN) {
        room.agentWs.send(
          JSON.stringify({ type: "resize", cols: event.cols, rows: event.rows } satisfies AgentCommand)
        );
      }
      break;
    }

    case "chat": {
      const room = getRoomForUser(userId);
      if (!room) return;
      // Validate chat message length
      if (!event.text || event.text.length > 2000) return;
      handleChatMessage(room, userId, event.text);
      break;
    }

    case "suggest_prompt": {
      const room = getRoomForUser(userId);
      if (!room) return;
      if (!event.text || event.text.length > 10_000) return;
      // Cap pending prompts to prevent memory exhaustion
      if (room.pendingPrompts.size >= 10) return;
      const promptId = uuid().slice(0, 8);
      room.pendingPrompts.set(promptId, event.text);
      // Send to the host (Claude owner) for approval
      const sender = room.host?.ws === ws ? room.host : room.guest;
      const hostMember = room.hostWs === room.host?.ws ? room.host : room.guest;
      if (hostMember) {
        sendToMember(hostMember, {
          type: "prompt_approval",
          id: promptId,
          text: event.text,
          from: sender?.username || "partner",
        });
      }
      // Also post to chat so everyone sees it
      handleChatMessage(room, userId, `💡 Prompt suggestion: ${event.text}`);
      break;
    }

    case "request_role_swap": {
      const room = getRoomForUser(userId);
      if (!room) return;
      room.swapRequestedBy = ws;
      const requester = room.host?.ws === ws ? room.host : room.guest;
      const other = requester === room.host ? room.guest : room.host;
      if (other) {
        sendToMember(other, { type: "role_swap_requested", by: ws.username! });
      }
      break;
    }

    case "confirm_role_swap": {
      const room = getRoomForUser(userId);
      if (!room) return;
      // Only the other user (not the requester) can confirm
      if (room.swapRequestedBy === ws) {
        console.log(`[handler] confirm_role_swap REJECTED: self-confirm by user=${userId}`);
        return;
      }
      if (!room.swapRequestedBy) {
        console.log(`[handler] confirm_role_swap REJECTED: no pending swap for user=${userId}`);
        return;
      }
      room.swapRequestedBy = null;
      if (event.accepted) {
        console.log(`[handler] confirm_role_swap ACCEPTED by user=${userId}`);
        swapRoles(room);
      }
      break;
    }

    case "reclaim_driver": {
      const room = getRoomForUser(userId);
      if (!room) return;
      // Only the host (Claude owner) can reclaim
      if (room.hostWs !== ws) {
        console.log(`[handler] reclaim_driver REJECTED: not host, user=${userId}`);
        return;
      }
      // Already the driver? No-op
      if (room.driverWs === ws) {
        console.log(`[handler] reclaim_driver REJECTED: already driver, user=${userId}`);
        return;
      }
      console.log(`[handler] reclaim_driver by user=${userId}`);
      swapRoles(room);
      break;
    }

    case "approve_prompt": {
      const room = getRoomForUser(userId);
      if (!room) return;
      // Only the host can approve
      if (room.hostWs !== ws) return;

      const stored = room.pendingPrompts?.get(event.id);
      if (!stored) return;
      room.pendingPrompts.delete(event.id);

      if (room.agentWs && room.agentWs.readyState === room.agentWs.OPEN) {
        if (event.id.startsWith("enter:")) {
          // Enter approval — forward the Enter keystroke to agent
          room.agentWs.send(
            JSON.stringify({ type: "terminal_input", data: "\r" } satisfies AgentCommand)
          );
          room.driverInputBuffer = "";
        } else {
          // Prompt suggestion — send as a prompt
          room.agentWs.send(
            JSON.stringify({ type: "send_prompt", text: stored } satisfies AgentCommand)
          );
        }
      }
      break;
    }

    case "reject_prompt": {
      const room = getRoomForUser(userId);
      if (!room) return;
      // Only the host can reject
      if (room.hostWs !== ws) return;

      if (event.id.startsWith("enter:")) {
        // Rejected Enter — send Ctrl+U to clear the typed line
        if (room.agentWs && room.agentWs.readyState === room.agentWs.OPEN) {
          room.agentWs.send(
            JSON.stringify({ type: "terminal_input", data: "\x15\r" } satisfies AgentCommand)
          );
        }
        room.driverInputBuffer = "";
      }

      room.pendingPrompts?.delete(event.id);
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
      room.extendRequestedBy = ws;
      const requester = room.host?.ws === ws ? room.host : room.guest;
      const other = requester === room.host ? room.guest : room.host;
      if (other) {
        sendToMember(other, { type: "extend_requested", by: ws.username! });
      }
      break;
    }

    case "confirm_extend": {
      const room = getRoomForUser(userId);
      if (!room) return;
      // Only the other user (not the requester) can confirm
      if (room.extendRequestedBy === ws) return;
      if (!room.extendRequestedBy) return;
      room.extendRequestedBy = null;
      if (event.accepted) extendSession(room);
      break;
    }

    case "checkin_response": {
      const room = getRoomForUser(userId);
      if (!room) return;
      if (!event.continueSession) endSession(room, "checkin_declined");
      break;
    }

    case "join_session": {
      const room = getRoom(event.sessionId);
      if (!room) {
        console.log(`[handler] join_session: room not found for ${event.sessionId}`);
        ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
        return;
      }

      console.log(`[handler] join_session: user=${userId} session=${event.sessionId}`);

      // Update the member's WebSocket to the new connection
      if (room.host?.userId === userId) {
        const oldWs = room.host.ws;
        room.host.ws = ws;
        // Update driverWs/hostWs if they pointed to the old socket
        if (room.driverWs === oldWs) room.driverWs = ws;
        if (room.hostWs === oldWs) room.hostWs = ws;
        console.log(`[handler] Updated host ws`);
      }
      if (room.guest?.userId === userId) {
        const oldWs = room.guest.ws;
        room.guest.ws = ws;
        if (room.driverWs === oldWs) room.driverWs = ws;
        if (room.hostWs === oldWs) room.hostWs = ws;
        console.log(`[handler] Updated guest ws`);
      }

      // Cancel any pending reconnect timer
      if (room.reconnectTimer) {
        clearTimeout(room.reconnectTimer);
        room.reconnectTimer = null;
      }

      // Determine this user's role and partner info
      const myMember = room.host?.ws === ws ? room.host
        : room.guest?.ws === ws ? room.guest
        : room.host?.userId === userId ? room.host
        : room.guest;
      const partnerMember = myMember === room.host ? room.guest : room.host;
      const myRole: Role = room.driverWs === ws ? "driver" : "navigator";

      // Send role + partner info so the session page knows the state
      if (partnerMember && myMember) {
        ws.send(JSON.stringify({
          type: "matched",
          sessionId: event.sessionId,
          partner: {
            username: partnerMember.username,
            avatarUrl: partnerMember.avatarUrl,
            githubId: 0,
          },
          role: myRole,
          isHost: myMember.isHost,
          hostEligible: myMember.hostEligible,
        } satisfies ServerEvent));
      }

      // Send current session state
      if (room.startedAt > 0) {
        ws.send(JSON.stringify({
          type: "session_started",
          endsAt: new Date(room.endsAt).toISOString(),
        } satisfies ServerEvent));
      }

      // Replay terminal buffer so the user sees existing output
      if (room.terminalBuffer.length > 0) {
        for (const chunk of room.terminalBuffer) {
          ws.send(JSON.stringify({ type: "terminal_data", data: chunk }));
        }
      }
      break;
    }

    case "solo_session": {
      const sessionId = uuid();
      const room = createRoom(sessionId);
      room.driverId = userId;
      room.driverWs = ws;
      room.hostWs = ws;

      const member: RoomMember = {
        ws,
        userId,
        username: ws.username!,
        avatarUrl: ws.avatarUrl!,
        githubId: 0,
        role: "driver",
        isHost: true,
        hostEligible: true,
      };
      room.host = member;
      // Set self as guest too so session lifecycle works
      room.guest = { ...member, isHost: false };
      indexUserToRoom(userId, sessionId);

      ws.send(JSON.stringify({
        type: "matched",
        sessionId,
        partner: { username: "Claude", avatarUrl: "", githubId: 0 },
        role: "driver" as Role,
        isHost: true,
        hostEligible: true,
      }));

      const assigned = assignAgentToRoom(sessionId, userId);
      if (!assigned) {
        ws.send(JSON.stringify({
          type: "error",
          message: "No host agent connected. Run the host agent on your machine first.",
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
    // Grace period: the user may be navigating from /queue to /session
    // and will reconnect shortly with a new WebSocket
    room.reconnectTimer = setTimeout(() => {
      // Check if the user reconnected (their WS in the room would be updated)
      const member =
        room.host?.userId === userId
          ? room.host
          : room.guest?.userId === userId
            ? room.guest
            : null;

      if (member && member.ws === ws) {
        // Still the old disconnected socket — user didn't reconnect
        broadcastToRoom(room, { type: "partner_left" });
        endSession(room, "partner_left");
      }
    }, RECONNECT_GRACE_MS);
  }
}
