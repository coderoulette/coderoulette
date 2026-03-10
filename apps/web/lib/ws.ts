const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

export function buildWsUrl(params: {
  userId: string;
  username: string;
  avatarUrl: string;
  isAgent?: boolean;
  sessionId?: string;
}): string {
  const url = new URL(WS_URL);
  url.searchParams.set("userId", params.userId);
  url.searchParams.set("username", params.username);
  url.searchParams.set("avatarUrl", params.avatarUrl);
  if (params.isAgent) url.searchParams.set("agent", "true");
  if (params.sessionId) url.searchParams.set("sessionId", params.sessionId);
  return url.toString();
}
