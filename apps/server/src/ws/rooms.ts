import type { WebSocket } from "ws";
import type { Role, ServerEvent } from "@clauderoulette/shared";

export interface RoomMember {
  ws: WebSocket;
  userId: string;
  username: string;
  avatarUrl: string;
  githubId: number;
  role: Role;
  isHost: boolean;
}

export interface Room {
  sessionId: string;
  host: RoomMember | null;
  guest: RoomMember | null;
  agentWs: WebSocket | null;
  driverId: string;
  startedAt: number;
  endsAt: number;
  extended: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  warningTimer: ReturnType<typeof setTimeout> | null;
  checkinTimer: ReturnType<typeof setTimeout> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();

export function createRoom(sessionId: string): Room {
  const room: Room = {
    sessionId,
    host: null,
    guest: null,
    agentWs: null,
    driverId: "",
    startedAt: 0,
    endsAt: 0,
    extended: false,
    timer: null,
    warningTimer: null,
    checkinTimer: null,
    reconnectTimer: null,
  };
  rooms.set(sessionId, room);
  return room;
}

export function getRoom(sessionId: string): Room | undefined {
  return rooms.get(sessionId);
}

export function deleteRoom(sessionId: string): void {
  const room = rooms.get(sessionId);
  if (room) {
    if (room.timer) clearTimeout(room.timer);
    if (room.warningTimer) clearTimeout(room.warningTimer);
    if (room.checkinTimer) clearTimeout(room.checkinTimer);
    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
    rooms.delete(sessionId);
  }
}

export function sendToMember(member: RoomMember, event: ServerEvent): void {
  if (member.ws.readyState === member.ws.OPEN) {
    member.ws.send(JSON.stringify(event));
  }
}

export function broadcastToRoom(room: Room, event: ServerEvent): void {
  if (room.host) sendToMember(room.host, event);
  if (room.guest) sendToMember(room.guest, event);
}

export function sendTerminalToClients(room: Room, data: Buffer): void {
  const event: ServerEvent = {
    type: "terminal_data",
    data: data.toString("base64"),
  };
  broadcastToRoom(room, event);
}

export function getRoomForUser(userId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.host?.userId === userId || room.guest?.userId === userId) {
      return room;
    }
  }
  return undefined;
}

export function getAllRooms(): Map<string, Room> {
  return rooms;
}
