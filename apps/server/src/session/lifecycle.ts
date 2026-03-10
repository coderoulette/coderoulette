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

  // Tell host agent to stop
  if (room.agentWs && room.agentWs.readyState === room.agentWs.OPEN) {
    room.agentWs.send(JSON.stringify({ type: "end_session" }));
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

  if (room.driverId === room.host.userId) {
    room.driverId = room.guest.userId;
    room.host.role = "navigator";
    room.guest.role = "driver";
  } else {
    room.driverId = room.host.userId;
    room.host.role = "driver";
    room.guest.role = "navigator";
  }

  broadcastToRoom(room, {
    type: "role_swapped",
    newDriverId: room.driverId,
  });
}
