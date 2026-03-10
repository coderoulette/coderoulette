"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ServerEvent } from "@clauderoulette/shared";

export default function InvitePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const inviteCode = params.code as string;
  const [waiting, setWaiting] = useState(false);

  const user = session?.user as
    | { id?: string; username?: string; name?: string; image?: string }
    | undefined;

  const onMessage = useCallback(
    (event: ServerEvent) => {
      if (event.type === "matched") {
        router.push(`/session/${event.sessionId}`);
      }
      if (event.type === "queue_joined") {
        setWaiting(true);
      }
    },
    [router]
  );

  const { send } = useWebSocket({
    userId: user?.id || "",
    username: user?.username || user?.name || "",
    avatarUrl: user?.image || "",
    onMessage,
    onOpen: () => {
      send({
        type: "join_queue",
        hostEligible: true,
        inviteCode,
      });
    },
  });

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6">
            <h1 className="text-2xl font-bold">
              You&apos;ve been invited to a ClaudeRoulette session!
            </h1>
            <p className="text-gray-400">Sign in with GitHub to join.</p>
            <button
              onClick={() => signIn("github")}
              className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
            >
              Sign in with GitHub
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 border-4 border-brand-400/30 border-t-brand-400 rounded-full animate-spin mx-auto" />
          <h2 className="text-xl font-bold">
            {waiting
              ? "Waiting for your partner to join..."
              : "Connecting..."}
          </h2>
          <p className="text-gray-400 text-sm">
            Share this link with your friend to start a direct session.
          </p>
        </div>
      </main>
    </div>
  );
}
