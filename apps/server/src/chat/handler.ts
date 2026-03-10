import { v4 as uuid } from "uuid";
import type { ChatMessage, ServerEvent } from "@clauderoulette/shared";
import { type Room, sendToMember } from "../ws/rooms.js";

export function handleChatMessage(
  room: Room,
  senderId: string,
  text: string
): void {
  const sender =
    room.host?.userId === senderId ? room.host : room.guest;
  if (!sender) return;

  const other =
    room.host?.userId === senderId ? room.guest : room.host;
  if (!other) return;

  const message: ChatMessage = {
    id: uuid(),
    sessionId: room.sessionId,
    userId: senderId,
    username: sender.username,
    avatarUrl: sender.avatarUrl,
    text,
    timestamp: new Date().toISOString(),
  };

  // Send to the other person (sender already has it locally)
  sendToMember(other, { type: "chat_message", message });
}
