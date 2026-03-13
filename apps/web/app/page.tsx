"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { Navbar } from "@/components/Navbar";

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [devUsername, setDevUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  // Update invite link on client only (avoid hydration mismatch)
  useEffect(() => {
    if (inviteCode) {
      setInviteLink(`${window.location.origin}/invite/${inviteCode}`);
    }
  }, [inviteCode]);

  const generateInvite = useCallback(() => {
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    const code = Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 8);
    setInviteCode(code);
    setCopied(false);
  }, []);

  const copyInviteLink = useCallback(() => {
    const link = `${window.location.origin}/invite/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-2xl text-center space-y-8">
          {/* Hero */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">
              Pair program with a{" "}
              <span className="text-brand-400">stranger</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-lg mx-auto">
              Get randomly matched with another developer for a 30-minute
              AI-powered coding jam session.
            </p>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="p-4 rounded-xl bg-surface-raised border border-white/5">
              <div className="text-2xl mb-2">1</div>
              <h3 className="font-semibold mb-1">Match</h3>
              <p className="text-sm text-gray-400">
                Hit the button and get paired with a random developer in seconds.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface-raised border border-white/5">
              <div className="text-2xl mb-2">2</div>
              <h3 className="font-semibold mb-1">Plan</h3>
              <p className="text-sm text-gray-400">
                Pick a fun project idea together or come up with your own.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface-raised border border-white/5">
              <div className="text-2xl mb-2">3</div>
              <h3 className="font-semibold mb-1">Build</h3>
              <p className="text-sm text-gray-400">
                Co-drive Claude Code in a shared terminal. Ship something cool
                in 30 minutes.
              </p>
            </div>
          </div>

          {/* CTA */}
          {session ? (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => router.push("/queue")}
                className="px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl text-lg transition-colors pulse-glow"
              >
                Find a partner
              </button>

              {!inviteCode ? (
                <button
                  onClick={generateInvite}
                  className="px-6 py-3 text-sm text-gray-400 hover:text-gray-200 border border-white/10 hover:border-white/20 rounded-xl transition-colors"
                >
                  Code with a friend
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-raised border border-white/10">
                  <p className="text-sm text-gray-400">Share this link with your friend:</p>
                  <div className="flex items-center gap-2">
                    <code className="px-3 py-1.5 bg-white/5 rounded-lg text-sm text-brand-400 font-mono">
                      {inviteLink || `/invite/${inviteCode}`}
                    </code>
                    <button
                      onClick={copyInviteLink}
                      className="px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <button
                    onClick={() => router.push(`/invite/${inviteCode}`)}
                    className="mt-1 px-6 py-2 text-sm bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 rounded-lg transition-colors"
                  >
                    Join waiting room
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  signIn("credentials", {
                    username: devUsername || "dev-user",
                    callbackUrl: "/",
                  });
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={devUsername}
                  onChange={(e) => setDevUsername(e.target.value)}
                  placeholder="Pick a username"
                  className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-400 text-lg"
                />
                <button
                  type="submit"
                  className="px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl text-lg transition-colors"
                >
                  Dev Sign In
                </button>
              </form>
              <button
                onClick={() => signIn("github")}
                className="px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl transition-colors flex items-center gap-3"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Sign in with GitHub
              </button>
            </div>
          )}

          <p className="text-sm text-gray-500">
            Sessions run during{" "}
            <span className="text-gray-300">Saturday Jam Hours</span> — 2pm EST
            &amp; 2pm CET
          </p>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-gray-600 border-t border-white/5">
        Built for fun. Two humans + one Claude = magic.
      </footer>
    </div>
  );
}
