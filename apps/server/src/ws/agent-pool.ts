import type { WebSocket } from "ws";

interface PooledAgent {
  ws: WebSocket;
  userId: string;
  connectedAt: number;
}

/** Agents indexed by userId — each user has their own agent */
const agentsByUser = new Map<string, PooledAgent>();

export function addAgent(ws: WebSocket, userId: string): void {
  agentsByUser.set(userId, { ws, userId, connectedAt: Date.now() });
  console.log(`[agent-pool] Agent added for user=${userId} (pool size: ${agentsByUser.size})`);
}

export function removeAgent(ws: WebSocket): void {
  for (const [userId, agent] of agentsByUser) {
    if (agent.ws === ws) {
      agentsByUser.delete(userId);
      console.log(`[agent-pool] Agent removed for user=${userId} (pool size: ${agentsByUser.size})`);
      return;
    }
  }
}

export function removeAgentByUserId(userId: string): void {
  if (agentsByUser.delete(userId)) {
    console.log(`[agent-pool] Agent removed for user=${userId} (pool size: ${agentsByUser.size})`);
  }
}

/** Claim a specific user's agent. Returns null if they don't have one connected. */
export function claimAgentForUser(userId: string): PooledAgent | null {
  const agent = agentsByUser.get(userId);
  if (agent && agent.ws.readyState === agent.ws.OPEN) {
    agentsByUser.delete(userId);
    console.log(`[agent-pool] Agent claimed for user=${userId} (pool size: ${agentsByUser.size})`);
    return agent;
  }
  // Clean up stale entry
  if (agent) agentsByUser.delete(userId);
  return null;
}

/** Check if a user has an agent connected and ready */
export function hasAgent(userId: string): boolean {
  const agent = agentsByUser.get(userId);
  if (agent && agent.ws.readyState === agent.ws.OPEN) return true;
  // Clean up stale entry
  if (agent) agentsByUser.delete(userId);
  return false;
}

export function poolSize(): number {
  return agentsByUser.size;
}
