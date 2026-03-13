import { v4 as uuid } from "uuid";
import type { Role, ServerEvent } from "@clauderoulette/shared";
import { getRandomProjects } from "@clauderoulette/shared";
import {
  type QueueItem,
  dequeue,
  size,
  getInviteWaiter,
  removeInviteWaiter,
} from "./queue.js";
import { createRoom, indexUserToRoom, type RoomMember } from "../ws/rooms.js";
import { assignAgentToRoom } from "../ws/handler.js";

export interface MatchResult {
  sessionId: string;
  host: QueueItem;
  guest: QueueItem;
}

function selectHost(a: QueueItem, b: QueueItem): [QueueItem, QueueItem] {
  // Prefer lower latency for host. If neither is host-eligible, pick the better one anyway.
  if (!a.hostEligible && b.hostEligible) return [b, a];
  if (a.hostEligible && !b.hostEligible) return [a, b];

  // Both eligible or neither — pick lower latency
  if (a.latencyMs <= b.latencyMs) return [a, b];
  return [b, a];
}

function notifyMatch(
  host: QueueItem,
  guest: QueueItem,
  sessionId: string
): void {
  const projects = getRandomProjects(3);

  const hostEvent: ServerEvent = {
    type: "matched",
    sessionId,
    partner: {
      username: guest.username,
      avatarUrl: guest.avatarUrl,
      githubId: 0,
    },
    role: "driver" as Role,
    isHost: true,
    hostEligible: host.hostEligible,
  };

  const guestEvent: ServerEvent = {
    type: "matched",
    sessionId,
    partner: {
      username: host.username,
      avatarUrl: host.avatarUrl,
      githubId: 0,
    },
    role: "navigator" as Role,
    isHost: false,
    hostEligible: guest.hostEligible,
  };

  const suggestionsEvent: ServerEvent = {
    type: "project_suggestions",
    projects,
  };

  if (host.ws.readyState === host.ws.OPEN) {
    host.ws.send(JSON.stringify(hostEvent));
    host.ws.send(JSON.stringify(suggestionsEvent));
  }
  if (guest.ws.readyState === guest.ws.OPEN) {
    guest.ws.send(JSON.stringify(guestEvent));
    guest.ws.send(JSON.stringify(suggestionsEvent));
  }
}

export function tryMatch(): MatchResult | null {
  if (size() < 2) return null;

  const a = dequeue()!;
  const b = dequeue()!;
  const [host, guest] = selectHost(a, b);
  const sessionId = uuid();

  // Create the room
  const room = createRoom(sessionId);
  room.driverId = host.userId;
  room.driverWs = host.ws;
  room.hostWs = host.ws;

  const hostMember: RoomMember = {
    ws: host.ws,
    userId: host.userId,
    username: host.username,
    avatarUrl: host.avatarUrl,
    githubId: 0,
    role: "driver",
    isHost: true,
    hostEligible: host.hostEligible,
  };

  const guestMember: RoomMember = {
    ws: guest.ws,
    userId: guest.userId,
    username: guest.username,
    avatarUrl: guest.avatarUrl,
    githubId: 0,
    role: "navigator",
    isHost: false,
    hostEligible: guest.hostEligible,
  };

  room.host = hostMember;
  room.guest = guestMember;
  indexUserToRoom(host.userId, sessionId);
  indexUserToRoom(guest.userId, sessionId);

  notifyMatch(host, guest, sessionId);

  // Try to assign a pooled agent
  // Assign the host user's agent to this room
  const assigned = assignAgentToRoom(sessionId, host.userId);
  if (!assigned) {
    const noAgentError = JSON.stringify({
      type: "error",
      message: "Host agent not connected. The host needs to run the agent on their machine.",
    });
    if (host.ws.readyState === host.ws.OPEN) {
      host.ws.send(noAgentError);
    }
    if (guest.ws.readyState === guest.ws.OPEN) {
      guest.ws.send(noAgentError);
    }
  }

  return { sessionId, host, guest };
}

export function tryInviteMatch(
  newcomer: QueueItem,
  inviteCode: string
): MatchResult | null {
  const waiter = getInviteWaiter(inviteCode);
  if (!waiter) return null;

  removeInviteWaiter(inviteCode);
  const [host, guest] = selectHost(waiter, newcomer);
  const sessionId = uuid();

  const room = createRoom(sessionId);
  room.driverId = host.userId;
  room.driverWs = host.ws;
  room.hostWs = host.ws;

  room.host = {
    ws: host.ws,
    userId: host.userId,
    username: host.username,
    avatarUrl: host.avatarUrl,
    githubId: 0,
    role: "driver",
    isHost: true,
    hostEligible: host.hostEligible,
  };

  room.guest = {
    ws: guest.ws,
    userId: guest.userId,
    username: guest.username,
    avatarUrl: guest.avatarUrl,
    githubId: 0,
    role: "navigator",
    isHost: false,
    hostEligible: guest.hostEligible,
  };

  indexUserToRoom(host.userId, sessionId);
  indexUserToRoom(guest.userId, sessionId);

  notifyMatch(host, guest, sessionId);

  // Assign the host user's agent to this room
  const assigned = assignAgentToRoom(sessionId, host.userId);
  if (!assigned) {
    const noAgentError = JSON.stringify({
      type: "error",
      message: "Host agent not connected. The host needs to run the agent on their machine.",
    });
    if (host.ws.readyState === host.ws.OPEN) {
      host.ws.send(noAgentError);
    }
    if (guest.ws.readyState === guest.ws.OPEN) {
      guest.ws.send(noAgentError);
    }
  }

  return { sessionId, host, guest };
}
