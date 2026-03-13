"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";

export default function HostPage() {
  const { data: session } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/auth/ws-token")
        .then((r) => r.json())
        .then((data) => setToken(data.token))
        .catch(() => setToken(null));
    }
  }, [session]);

  const hostCommand = token
    ? `npx coderoulette-host -s wss://coderoulette.ee/ws -t ${token}`
    : "npx coderoulette-host -s wss://coderoulette.ee/ws -t YOUR_TOKEN";

  const copyCommand = () => {
    navigator.clipboard.writeText(hostCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl w-full space-y-10">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Host a <span className="text-brand-400">CodeRoulette</span> session
            </h1>
            <p className="text-lg text-zinc-400 max-w-lg mx-auto">
              Run the host agent on your machine so Claude Code executes locally.
              Only the driver needs Claude Code installed — navigators just use the browser.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="p-5 rounded-xl bg-surface-raised border border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
                  <span className="text-brand-400 font-bold text-sm">1</span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-zinc-100">Install Claude Code</h3>
                  <p className="text-sm text-zinc-400">
                    You need Claude Code installed globally. If you already have it, skip this step.
                  </p>
                  <code className="block text-sm bg-black/40 border border-white/5 rounded-lg px-4 py-2.5 text-brand-400 font-mono">
                    npm install -g @anthropic-ai/claude-code
                  </code>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-xl bg-surface-raised border border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
                  <span className="text-brand-400 font-bold text-sm">2</span>
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-semibold text-zinc-100">Run the host agent</h3>
                  <p className="text-sm text-zinc-400">
                    {session?.user
                      ? "Copy this command — it includes your personal auth token."
                      : "Sign in first to get your personalized command with auth token."}
                  </p>
                  {session?.user && token ? (
                    <>
                      <div className="relative">
                        <code className="block text-sm bg-black/40 border border-white/5 rounded-lg px-4 py-2.5 pr-20 text-brand-400 font-mono overflow-x-auto whitespace-nowrap">
                          npx coderoulette-host -s wss://coderoulette.ee/ws -t &lt;token&gt;
                        </code>
                        <button
                          onClick={copyCommand}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs rounded-md border transition-all
                            border-white/10 hover:border-brand-400/50 text-zinc-400 hover:text-brand-400"
                        >
                          {copiedCommand ? "Copied!" : "Copy full command"}
                        </button>
                      </div>
                      <div className="relative mt-2">
                        <div className="text-[11px] text-zinc-600 mb-1">Your token (valid for 24h):</div>
                        <code className="block text-xs bg-black/40 border border-white/5 rounded-lg px-4 py-2 pr-20 text-zinc-500 font-mono overflow-x-auto whitespace-nowrap">
                          {token.slice(0, 20)}...{token.slice(-10)}
                        </code>
                        <button
                          onClick={copyToken}
                          className="absolute right-2 bottom-1.5 px-3 py-1 text-xs rounded-md border transition-all
                            border-white/10 hover:border-brand-400/50 text-zinc-400 hover:text-brand-400"
                        >
                          {copiedToken ? "Copied!" : "Copy token"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-amber-400/80">
                      Sign in to generate your auth token.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-xl bg-surface-raised border border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
                  <span className="text-brand-400 font-bold text-sm">3</span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-zinc-100">That&apos;s it</h3>
                  <p className="text-sm text-zinc-400">
                    When someone matches with you (or you start a solo session), Claude
                    spawns automatically on your machine. The terminal output streams
                    to both participants in real time.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="p-4 rounded-xl border border-brand-400/20 bg-brand-500/5">
            <p className="text-sm text-zinc-300">
              <span className="font-semibold text-brand-400">Note:</span>{" "}
              Only the driver needs Claude Code and the host agent.
              Navigators participate entirely through the browser — they see the
              terminal, chat, and can suggest prompts without installing anything.
            </p>
          </div>

          {/* Optional flags */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Optional flags</h3>
            <div className="text-sm text-zinc-400 space-y-2">
              <div className="flex gap-3">
                <code className="text-zinc-300 font-mono shrink-0">-w, --workdir &lt;path&gt;</code>
                <span>Directory where Claude Code runs (defaults to a temp directory)</span>
              </div>
              <div className="flex gap-3">
                <code className="text-zinc-300 font-mono shrink-0">-s, --server &lt;url&gt;</code>
                <span>WebSocket URL of the relay server</span>
              </div>
              <div className="flex gap-3">
                <code className="text-zinc-300 font-mono shrink-0">-t, --token &lt;token&gt;</code>
                <span>Auth token (also via CODEROULETTE_TOKEN env var)</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
