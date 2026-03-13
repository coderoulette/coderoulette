const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_REFRESH_MS = 60 * 60 * 1000; // Refresh every hour

async function getWsToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now - tokenFetchedAt < TOKEN_REFRESH_MS) {
    return cachedToken;
  }

  const res = await fetch("/api/auth/ws-token");
  if (!res.ok) {
    throw new Error("Failed to get WS token — are you signed in?");
  }
  const data = await res.json();
  cachedToken = data.token;
  tokenFetchedAt = now;
  return data.token;
}

export async function buildWsUrl(params?: {
  isAgent?: boolean;
  sessionId?: string;
}): Promise<string> {
  const token = await getWsToken();
  const url = new URL(WS_URL);
  url.searchParams.set("token", token);
  if (params?.isAgent) url.searchParams.set("agent", "true");
  if (params?.sessionId) url.searchParams.set("sessionId", params.sessionId);
  return url.toString();
}
