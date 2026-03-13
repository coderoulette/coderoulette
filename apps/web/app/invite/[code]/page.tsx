"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useCallback, useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ServerEvent } from "@clauderoulette/shared";

export default function InvitePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const inviteCode = params.code as string;
  const autoHost = searchParams.get("host") === "1";
  const [waiting, setWaiting] = useState(false);
  const [roleChosen, setRoleChosen] = useState(false);
  const hostEligibleRef = useRef(false);

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

  const { send, connected } = useWebSocket({
    enabled: !!user?.id,
    onMessage,
  });

  const joinAs = useCallback((eligible: boolean) => {
    hostEligibleRef.current = eligible;
    setRoleChosen(true);
    send({
      type: "join_queue",
      hostEligible: eligible,
      inviteCode,
    });
  }, [send, inviteCode]);

  // Auto-join as host when returning from /host setup page
  useEffect(() => {
    if (autoHost && connected && !roleChosen) {
      joinAs(true);
    }
  }, [autoHost, connected, roleChosen, joinAs]);

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6">
            <h1 className="text-2xl font-bold">
              You&apos;ve been invited to a CodeRoulette session!
            </h1>
            <p className="text-gray-400">Sign in to join.</p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => signIn("github", { callbackUrl: `/invite/${inviteCode}` })}
                className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
              >
                Sign in with GitHub
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Role selection before joining
  if (!roleChosen) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="max-w-lg text-center space-y-8">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-zinc-100">You&apos;re invited!</h2>
              <p className="text-zinc-400 text-sm">
                One person hosts Claude Code on their machine. The other joins through the browser.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => router.push(`/host?return=/invite/${inviteCode}%3Fhost%3D1`)}
                className="p-5 rounded-xl bg-surface-raised border border-white/5 hover:border-brand-400/40 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0 group-hover:bg-brand-500/30 transition-colors">
                    <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100">Host (I have Claude Code)</h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      Claude Code runs on your machine. We&apos;ll walk you through the setup first.
                    </p>
                    <p className="text-xs text-zinc-600 mt-2">
                      Requires: Node.js 18+, Claude Code installed
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => joinAs(false)}
                className="p-5 rounded-xl bg-surface-raised border border-white/5 hover:border-accent-violet/40 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-violet/20 flex items-center justify-center shrink-0 group-hover:bg-accent-violet/30 transition-colors">
                    <svg className="w-5 h-5 text-accent-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100">Navigate (just a browser)</h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      Nothing to install. You see the same terminal as the host, chat, and suggest prompts.
                    </p>
                  </div>
                </div>
              </button>
            </div>
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
