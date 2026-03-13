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
  hostEligible: boolean;
}

export interface Room {
  sessionId: string;
  host: RoomMember | null;
  guest: RoomMember | null;
  agentWs: WebSocket | null;
  driverId: string;
  driverWs: WebSocket | null;
  /** The host-eligible user's WS — they can always reclaim driver */
  hostWs: WebSocket | null;
  startedAt: number;
  endsAt: number;
  extended: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  warningTimer: ReturnType<typeof setTimeout> | null;
  checkinTimer: ReturnType<typeof setTimeout> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  /** Rolling buffer of recent terminal output (base64 chunks) for replay on join */
  terminalBuffer: string[];
  /** Who requested a role swap (WS ref) — only the other user can confirm */
  swapRequestedBy: WebSocket | null;
  /** Pending prompt suggestions awaiting driver/host approval */
  pendingPrompts: Map<string, string>;
  /** Tracks what a non-host driver has typed on the current line (for Enter approval display) */
  driverInputBuffer: string;
  /** Who requested a session extension (WS ref) — only the other user can confirm */
  extendRequestedBy: WebSocket | null;
  /** Debug flag */
  _loggedTerminal?: boolean;
}

const rooms = new Map<string, Room>();
/** userId -> sessionId index for O(1) lookups */
const userRoomIndex = new Map<string, string>();

export function createRoom(sessionId: string): Room {
  const room: Room = {
    sessionId,
    host: null,
    guest: null,
    agentWs: null,
    driverId: "",
    driverWs: null,
    hostWs: null,
    startedAt: 0,
    endsAt: 0,
    extended: false,
    timer: null,
    warningTimer: null,
    checkinTimer: null,
    reconnectTimer: null,
    terminalBuffer: [],
    swapRequestedBy: null,
    pendingPrompts: new Map(),
    driverInputBuffer: "",
    extendRequestedBy: null,
  };
  rooms.set(sessionId, room);
  return room;
}

export function indexUserToRoom(userId: string, sessionId: string): void {
  userRoomIndex.set(userId, sessionId);
}

export function removeUserFromIndex(userId: string): void {
  userRoomIndex.delete(userId);
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
    // Clean up user index
    if (room.host) userRoomIndex.delete(room.host.userId);
    if (room.guest) userRoomIndex.delete(room.guest.userId);
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
  if (room.guest && room.guest.ws !== room.host?.ws) {
    sendToMember(room.guest, event);
  }
}

const MAX_TERMINAL_BUFFER = 500;

export function sendTerminalToClients(room: Room, data: Buffer): void {
  const b64 = data.toString("base64");
  const event: ServerEvent = {
    type: "terminal_data",
    data: b64,
  };
  // DEBUG: log who we're sending to
  const hostOpen = room.host?.ws?.readyState === room.host?.ws?.OPEN;
  const guestOpen = room.guest?.ws?.readyState === room.guest?.ws?.OPEN;
  const sameUser = room.guest?.userId === room.host?.userId;
  if (!room._loggedTerminal) {
    console.log(`[rooms] sendTerminalToClients: host=${room.host?.userId}(open=${hostOpen}) guest=${room.guest?.userId}(open=${guestOpen}) sameUser=${sameUser}`);
    room._loggedTerminal = true;
  }
  broadcastToRoom(room, event);

  // Buffer for replay on late join
  room.terminalBuffer.push(b64);
  if (room.terminalBuffer.length > MAX_TERMINAL_BUFFER) {
    room.terminalBuffer.splice(0, room.terminalBuffer.length - MAX_TERMINAL_BUFFER);
  }
}

export function getRoomForUser(userId: string): Room | undefined {
  const sessionId = userRoomIndex.get(userId);
  if (sessionId) {
    return rooms.get(sessionId);
  }
  return undefined;
}

export function getAllRooms(): Map<string, Room> {
  return rooms;
}
