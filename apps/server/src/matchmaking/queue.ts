import type { WebSocket } from "ws";
import type { QueueEntry } from "@clauderoulette/shared";

export interface QueueItem extends QueueEntry {
  ws: WebSocket;
}

const queue: QueueItem[] = [];
const inviteQueues = new Map<string, QueueItem>();

export function enqueue(item: QueueItem): number {
  // Handle invite codes — private 2-person queues
  if (item.inviteCode) {
    const waiting = inviteQueues.get(item.inviteCode);
    if (waiting) {
      // Someone is already waiting with this invite code
      inviteQueues.delete(item.inviteCode);
      return -1; // Signal: match found via invite
    }
    inviteQueues.set(item.inviteCode, item);
    return 0; // Waiting for invite partner
  }

  queue.push(item);
  return queue.length;
}

export function dequeue(): QueueItem | undefined {
  return queue.shift();
}

export function removeByUserId(userId: string): void {
  const idx = queue.findIndex((item) => item.userId === userId);
  if (idx !== -1) queue.splice(idx, 1);

  // Also check invite queues
  for (const [code, item] of inviteQueues) {
    if (item.userId === userId) {
      inviteQueues.delete(code);
      break;
    }
  }
}

export function getInviteWaiter(inviteCode: string): QueueItem | undefined {
  return inviteQueues.get(inviteCode);
}

export function removeInviteWaiter(inviteCode: string): void {
  inviteQueues.delete(inviteCode);
}

export function size(): number {
  return queue.length;
}

export function getQueue(): QueueItem[] {
  return queue;
}
