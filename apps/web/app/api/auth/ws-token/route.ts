import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me"
);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = session.user as Record<string, unknown>;

  const token = await new SignJWT({
    userId: user.id as string,
    username: (user.username || user.name || "anonymous") as string,
    avatarUrl: (user.avatarUrl || user.image || "") as string,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  return NextResponse.json({ token });
}
