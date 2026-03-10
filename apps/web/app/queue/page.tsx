"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ServerEvent } from "@clauderoulette/shared";

export default function QueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [queueState, setQueueState] = useState<
    "connecting" | "queued" | "matched"
  >("connecting");
  const [position, setPosition] = useState(0);
  const [partner, setPartner] = useState<{
    username: string;
    avatarUrl: string;
  } | null>(null);

  const user = session?.user as
    | { id?: string; username?: string; name?: string; image?: string }
    | undefined;

  const onMessage = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case "queue_joined":
          setQueueState("queued");
          setPosition(event.position);
          break;
        case "queue_update":
          setPosition(event.position);
          break;
        case "matched":
          setQueueState("matched");
          setPartner(event.partner);
          // Navigate to session after a brief moment
          setTimeout(() => {
            router.push(`/session/${event.sessionId}`);
          }, 2000);
          break;
      }
    },
    [router]
  );

  const { send, connected } = useWebSocket({
    userId: user?.id || "",
    username: user?.username || user?.name || "",
    avatarUrl: user?.image || "",
    onMessage,
    onOpen: () => {
      // Auto-join queue on connect
      send({ type: "join_queue", hostEligible: true });
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    return () => {
      send({ type: "leave_queue" });
    };
  }, [send]);

  if (status === "loading") return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-8">
          {queueState === "connecting" && (
            <div className="space-y-4">
              <div className="w-16 h-16 border-4 border-brand-400/30 border-t-brand-400 rounded-full animate-spin mx-auto" />
              <p className="text-gray-400">Connecting...</p>
            </div>
          )}

          {queueState === "queued" && (
            <div className="space-y-6">
              <div className="w-24 h-24 rounded-full bg-brand-500/20 flex items-center justify-center mx-auto pulse-glow">
                <div className="w-16 h-16 rounded-full bg-brand-500/30 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-brand-400 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Looking for a partner...</h2>
                <p className="text-gray-400">
                  Hang tight, matching you with another developer
                </p>
                {position > 0 && (
                  <p className="text-sm text-gray-500">
                    Position in queue: {position}
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  send({ type: "leave_queue" });
                  router.push("/");
                }}
                className="px-6 py-2 text-sm text-gray-400 hover:text-gray-200 border border-white/10 hover:border-white/20 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {queueState === "matched" && partner && (
            <div className="space-y-6 animate-in">
              <div className="text-4xl font-bold text-brand-400">Matched!</div>
              <div className="flex items-center gap-4 justify-center">
                {user?.image && (
                  <img
                    src={user.image}
                    alt="You"
                    className="w-16 h-16 rounded-full border-2 border-brand-400"
                  />
                )}
                <span className="text-2xl text-gray-500">&amp;</span>
                <img
                  src={partner.avatarUrl}
                  alt={partner.username}
                  className="w-16 h-16 rounded-full border-2 border-brand-400"
                />
              </div>
              <p className="text-gray-300">
                You&apos;re paired with{" "}
                <span className="font-semibold text-white">
                  {partner.username}
                </span>
              </p>
              <p className="text-sm text-gray-500">
                Starting session...
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
