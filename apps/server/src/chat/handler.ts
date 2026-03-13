import { v4 as uuid } from "uuid";
import type { ChatMessage, ServerEvent } from "@clauderoulette/shared";
import { type Room, broadcastToRoom } from "../ws/rooms.js";

export function handleChatMessage(
  room: Room,
  senderId: string,
  text: string
): void {
  const sender =
    room.host?.userId === senderId ? room.host : room.guest;
  if (!sender) return;

  const message: ChatMessage = {
    id: uuid(),
    sessionId: room.sessionId,
    userId: senderId,
    username: sender.username,
    avatarUrl: sender.avatarUrl,
    text,
    timestamp: new Date().toISOString(),
  };

  // Broadcast to both users (client does not add messages locally)
  broadcastToRoom(room, { type: "chat_message", message });
}
