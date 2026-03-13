"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";

export default function HostPage() {
  const { data: session } = useSession();
  const router = useRouter();
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
              As a host, Claude Code runs on your machine. Your partner sees your terminal
              live in their browser — they don&apos;t need to install anything.
            </p>
          </div>

          {/* What you need */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <h3 className="font-semibold text-zinc-200 mb-3">What you need</h3>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5 shrink-0">&#10003;</span>
                <span><strong className="text-zinc-300">Node.js 18+</strong> — check with <code className="text-xs bg-black/40 px-1.5 py-0.5 rounded text-zinc-300">node --version</code></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5 shrink-0">&#10003;</span>
                <span><strong className="text-zinc-300">Claude Code</strong> — Anthropic&apos;s CLI. Install if you don&apos;t have it: <code className="text-xs bg-black/40 px-1.5 py-0.5 rounded text-zinc-300">npm install -g @anthropic-ai/claude-code</code></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5 shrink-0">&#10003;</span>
                <span><strong className="text-zinc-300">A GitHub account</strong> — for signing in (you&apos;ve already done this if you can see this page)</span>
              </li>
            </ul>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Setup — takes about 30 seconds</h3>

            {/* Step 1 */}
            <div className="p-5 rounded-xl bg-surface-raised border border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
                  <span className="text-brand-400 font-bold text-sm">1</span>
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <h3 className="font-semibold text-zinc-100">Open your terminal and run this command</h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      This downloads the host agent and connects it to CodeRoulette.
                      {!session?.user && " Sign in first to get your personalized command."}
                    </p>
                  </div>
                  {session?.user && token ? (
                    <>
                      <div className="relative">
                        <pre className="text-sm bg-black/40 border border-white/5 rounded-lg px-4 py-2.5 pr-4 text-brand-400 font-mono whitespace-pre-wrap break-all">
                          {hostCommand}
                        </pre>
                        <button
                          onClick={copyCommand}
                          className="mt-2 px-3 py-1 text-xs rounded-md border transition-all
                            border-white/10 hover:border-brand-400/50 text-zinc-400 hover:text-brand-400"
                        >
                          {copiedCommand ? "Copied!" : "Copy command"}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-600">
                        Token is embedded in the command and valid for 24 hours. Need just the token?{" "}
                        <button onClick={copyToken} className="text-zinc-400 hover:text-brand-400 underline underline-offset-2">
                          {copiedToken ? "Copied!" : "Copy token"}
                        </button>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-amber-400/80">
                      Sign in with GitHub to generate your command.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-xl bg-surface-raised border border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
                  <span className="text-brand-400 font-bold text-sm">2</span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-zinc-100">Keep it running, then find a partner</h3>
                  <p className="text-sm text-zinc-400">
                    Once you see <code className="text-xs bg-black/40 px-1.5 py-0.5 rounded text-emerald-400">Connected</code> in
                    your terminal, the agent is ready. Come back here and join the queue — when you
                    get matched, Claude Code spawns automatically on your machine.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex justify-center">
            <button
              onClick={() => router.push("/queue")}
              className="px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl text-lg transition-colors"
            >
              Find a partner
            </button>
          </div>

          {/* What happens during a session */}
          <div className="p-4 rounded-xl border border-brand-400/20 bg-brand-500/5 space-y-3">
            <h3 className="font-semibold text-brand-400 text-sm">What happens during a session?</h3>
            <ul className="text-sm text-zinc-300 space-y-1.5">
              <li>Claude Code runs in an isolated temp directory on your machine (not your home folder)</li>
              <li>Your partner sees the same terminal output in their browser in real-time</li>
              <li>One person drives at a time, but you can swap roles whenever you want</li>
              <li>As the host, you always have the final say — when your partner suggests a prompt, you see it in the UI and choose to run or dismiss it before anything is sent to Claude</li>
              <li>Sessions last 30 minutes with an optional 15-minute extension</li>
            </ul>
          </div>

          {/* Advanced options */}
          <details className="group">
            <summary className="text-sm font-semibold text-zinc-400 cursor-pointer hover:text-zinc-300 transition-colors">
              Advanced options
            </summary>
            <div className="mt-3 text-sm text-zinc-400 space-y-2 pl-4 border-l border-white/5">
              <div className="flex gap-3">
                <code className="text-zinc-300 font-mono shrink-0">-w, --workdir &lt;path&gt;</code>
                <span>Run Claude Code in a specific directory instead of a temp folder</span>
              </div>
              <div className="flex gap-3">
                <code className="text-zinc-300 font-mono shrink-0">-s, --server &lt;url&gt;</code>
                <span>Connect to a different relay server (for self-hosting)</span>
              </div>
              <div className="flex gap-3">
                <code className="text-zinc-300 font-mono shrink-0">-t, --token &lt;token&gt;</code>
                <span>Auth token (also settable via <code className="text-zinc-300">CODEROULETTE_TOKEN</code> env var)</span>
              </div>
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}
