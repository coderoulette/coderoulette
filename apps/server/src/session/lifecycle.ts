import {
  SESSION_DURATION_MS,
  EXTENSION_DURATION_MS,
  WARNING_AT_MS,
  CHECKIN_AT_MS,
  REMATCH_WINDOW_MS,
} from "@clauderoulette/shared";
import {
  type Room,
  getRoom,
  deleteRoom,
  broadcastToRoom,
  sendToMember,
} from "../ws/rooms.js";
import { addAgent } from "../ws/agent-pool.js";

export function startSession(room: Room): void {
  const now = Date.now();
  room.startedAt = now;
  room.endsAt = now + SESSION_DURATION_MS;

  broadcastToRoom(room, {
    type: "session_started",
    endsAt: new Date(room.endsAt).toISOString(),
  });

  // 15-minute check-in
  room.checkinTimer = setTimeout(() => {
    broadcastToRoom(room, {
      type: "checkin",
      message: "Both enjoying this? Keep going?",
    });
  }, CHECKIN_AT_MS);

  // 5-minute warning
  room.warningTimer = setTimeout(() => {
    broadcastToRoom(room, {
      type: "time_warning",
      remainingMs: WARNING_AT_MS,
    });
  }, SESSION_DURATION_MS - WARNING_AT_MS);

  // Session end
  room.timer = setTimeout(() => {
    endSession(room, "timer");
  }, SESSION_DURATION_MS);
}

export function endSession(
  room: Room,
  reason: "timer" | "partner_left" | "rematch" | "checkin_declined"
): void {
  broadcastToRoom(room, { type: "session_ended", reason });

  // Tell host agent to stop, then re-pool it under the host user's ID
  if (room.agentWs && room.agentWs.readyState === room.agentWs.OPEN) {
    room.agentWs.send(JSON.stringify({ type: "end_session" }));
    const agentWs = room.agentWs;
    const hostUserId = room.host?.userId;
    // Re-add to pool after a short delay so the agent can clean up its PTY
    setTimeout(() => {
      if (agentWs.readyState === agentWs.OPEN && hostUserId) {
        addAgent(agentWs, hostUserId);
        agentWs.send(JSON.stringify({ type: "pooled", message: "Waiting for session assignment..." }));
      }
    }, 2000);
  }

  deleteRoom(room.sessionId);
}

export function extendSession(room: Room): boolean {
  if (room.extended) return false;
  room.extended = true;

  // Clear existing end timer
  if (room.timer) clearTimeout(room.timer);
  if (room.warningTimer) clearTimeout(room.warningTimer);

  room.endsAt += EXTENSION_DURATION_MS;
  const remainingMs = room.endsAt - Date.now();

  broadcastToRoom(room, {
    type: "session_extended",
    newEndsAt: new Date(room.endsAt).toISOString(),
  });

  // New 5-minute warning
  if (remainingMs > WARNING_AT_MS) {
    room.warningTimer = setTimeout(() => {
      broadcastToRoom(room, {
        type: "time_warning",
        remainingMs: WARNING_AT_MS,
      });
    }, remainingMs - WARNING_AT_MS);
  }

  // New end timer
  room.timer = setTimeout(() => {
    endSession(room, "timer");
  }, remainingMs);

  return true;
}

export function canRematch(room: Room): boolean {
  return Date.now() - room.startedAt < REMATCH_WINDOW_MS;
}

export function swapRoles(room: Room): void {
  if (!room.host || !room.guest) return;

  const hostWsId = (room.host.ws as any)._socket?.remotePort || "?";
  const guestWsId = (room.guest.ws as any)._socket?.remotePort || "?";
  const oldDriverPort = (room.driverWs as any)?._socket?.remotePort || "?";

  // Swap based on current role, not userId
  if (room.host.role === "driver") {
    room.host.role = "navigator";
    room.guest.role = "driver";
    room.driverId = room.guest.userId;
    room.driverWs = room.guest.ws;
  } else {
    room.host.role = "driver";
    room.guest.role = "navigator";
    room.driverId = room.host.userId;
    room.driverWs = room.host.ws;
  }

  const newDriverPort = (room.driverWs as any)?._socket?.remotePort || "?";
  console.log(`[lifecycle] swapRoles: host=${room.host.userId}(port=${hostWsId},role=${room.host.role}) guest=${room.guest.userId}(port=${guestWsId},role=${room.guest.role}) driverWs: port ${oldDriverPort} → ${newDriverPort}`);

  // Send individual events so each user knows their new role
  sendToMember(room.host, { type: "role_swapped", newRole: room.host.role });
  sendToMember(room.guest, { type: "role_swapped", newRole: room.guest.role });
}
