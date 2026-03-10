import type { WebSocket } from "ws";

interface PooledAgent {
  ws: WebSocket;
  userId: string;
  connectedAt: number;
}

const pool: PooledAgent[] = [];

export function addAgent(ws: WebSocket, userId: string): void {
  pool.push({ ws, userId, connectedAt: Date.now() });
  console.log(`[agent-pool] Agent added (pool size: ${pool.length})`);
}

export function removeAgent(ws: WebSocket): void {
  const idx = pool.findIndex((a) => a.ws === ws);
  if (idx !== -1) {
    pool.splice(idx, 1);
    console.log(`[agent-pool] Agent removed (pool size: ${pool.length})`);
  }
}

export function claimAgent(): PooledAgent | null {
  // Find first agent with an open connection
  while (pool.length > 0) {
    const agent = pool.shift()!;
    if (agent.ws.readyState === agent.ws.OPEN) {
      console.log(`[agent-pool] Agent claimed (pool size: ${pool.length})`);
      return agent;
    }
  }
  return null;
}

export function poolSize(): number {
  return pool.length;
}
