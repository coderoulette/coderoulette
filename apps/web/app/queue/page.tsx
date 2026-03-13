"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Terminal, type TerminalHandle } from "@/components/Terminal";
import { ChatSidebar } from "@/components/ChatSidebar";
import { PromptInput } from "@/components/PromptInput";
import { Timer } from "@/components/Timer";
import { RoleSwapButton } from "@/components/RoleSwapButton";
import type {
  ServerEvent,
  ChatMessage,
  Role,
} from "@clauderoulette/shared";
import { buildWsUrl } from "@/lib/ws";

type PageState = "connecting" | "role_select" | "queued" | "matched" | "session" | "ended";

export default function QueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoHost = searchParams.get("host") === "1";

  const [pageState, setPageState] = useState<PageState>("connecting");
  const [position, setPosition] = useState(0);
  const [role, setRole] = useState<Role>("navigator");
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [extended, setExtended] = useState(false);
  const [partner, setPartner] = useState<{ username: string; avatarUrl: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [projectVotes, setProjectVotes] = useState<Record<string, { up: number; down: number }>>({});
  const [swapRequested, setSwapRequested] = useState(false);
  const [swapRequestedBy, setSwapRequestedBy] = useState<string>();
  const [driverInput, setDriverInput] = useState("");
  const [endReason, setEndReason] = useState<string>("");
  const [noAgentError, setNoAgentError] = useState(false);
  const [hostEligible, setHostEligible] = useState<boolean | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [pendingPrompts, setPendingPrompts] = useState<{ id: string; text: string; from: string }[]>([]);

  const terminalRef = useRef<TerminalHandle>(null);
  const terminalBufferRef = useRef<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const user = session?.user as
    | { id?: string; username?: string; name?: string; image?: string }
    | undefined;

  const send = useCallback((event: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  // Single WS connection — stays alive from queue through session
  useEffect(() => {
    if (!user?.id) return;
    intentionalCloseRef.current = false;

    async function connect() {
      try {
        const url = await buildWsUrl();
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptRef.current = 0;
          setPageState("role_select");
        };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as ServerEvent;
          switch (event.type) {
            case "queue_joined":
              setPageState("queued");
              setPosition(event.position);
              break;
            case "queue_update":
              setPosition(event.position);
              break;
            case "matched":
              setPartner(event.partner);
              setRole(event.role);
              setIsHost(event.isHost && event.hostEligible);
              setPageState("matched");
              setTimeout(() => setPageState("session"), 1500);
              break;
            case "session_started":
              setEndsAt(event.endsAt);
              break;
            case "terminal_data":
              if (terminalRef.current) {
                terminalRef.current.write(event.data);
              } else {
                terminalBufferRef.current.push(event.data);
              }
              break;
            case "chat_message":
              setChatMessages((prev) => [...prev, event.message]);
              break;
            case "project_votes":
              setProjectVotes(event.votes);
              break;
            case "role_swap_requested":
              setSwapRequested(true);
              setSwapRequestedBy(event.by);
              break;
            case "role_swapped":
              setRole(event.newRole);
              setSwapRequested(false);
              setSwapRequestedBy(undefined);
              break;
            case "prompt_approval":
              setPendingPrompts((prev) => [...prev, { id: event.id, text: event.text, from: event.from }]);
              break;
            case "session_extended":
              setEndsAt(event.newEndsAt);
              setExtended(true);
              break;
            case "time_warning":
              break;
            case "session_ended":
              setEndReason(event.reason);
              setPageState("ended");
              break;
            case "partner_left":
              setEndReason("partner_left");
              setPageState("ended");
              break;
            case "driver_input":
              setDriverInput((prev) => {
                const d = event.data;
                if (d === "\r" || d === "\n") return "";
                if (d === "\x7f" || d === "\b") return prev.slice(0, -1);
                if (d.startsWith("\x1b")) return prev;
                if (d.length === 1 && d.charCodeAt(0) < 32) return prev;
                return prev + d;
              });
              break;
            case "error":
              console.error("Server error:", event.message);
              if (event.message.toLowerCase().includes("no host agent")) {
                setNoAgentError(true);
              }
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        // Reconnect with exponential backoff unless intentionally closed
        if (!intentionalCloseRef.current) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptRef.current),
            30000
          );
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };
      } catch (err) {
        console.error("[queue] WS connect failed:", err);
        if (!intentionalCloseRef.current) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      }
    }

    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 15000);

    return () => {
      intentionalCloseRef.current = true;
      clearInterval(pingInterval);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [user?.id]);

  // Flush buffered terminal data when terminal mounts
  useEffect(() => {
    if (pageState === "session" && terminalRef.current && terminalBufferRef.current.length > 0) {
      const buf = terminalBufferRef.current;
      terminalBufferRef.current = [];
      const flush = () => {
        for (const data of buf) {
          terminalRef.current?.write(data);
        }
      };
      setTimeout(flush, 100);
    }
  }, [pageState]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Auto-join as host when returning from /host setup page
  useEffect(() => {
    if (autoHost && pageState === "role_select") {
      setHostEligible(true);
      setPageState("queued");
      send({ type: "join_queue", hostEligible: true });
    }
  }, [autoHost, pageState, send]);

  if (status === "loading") return <div style={{color:"white",padding:20}}>Loading auth...</div>;

  const isDriver = role === "driver";

  // ==================== NO AGENT AVAILABLE ====================
  if (noAgentError) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="max-w-md text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
              <span className="text-3xl">!</span>
            </div>
            <h2 className="text-2xl font-bold text-zinc-100">No host agent connected</h2>
            <p className="text-zinc-400">
              A session needs someone running the host agent so Claude Code can execute locally.
              Either run it yourself or wait for a partner who has it running.
            </p>
            <div className="p-3 rounded-lg bg-black/30 border border-white/5 text-left">
              <p className="text-xs text-zinc-500 mb-1.5">Quick start — run this in your terminal:</p>
              <code className="text-sm text-brand-400 font-mono">npx coderoulette-host</code>
            </div>
            <div className="flex flex-col items-center gap-3">
              <a
                href="/host"
                className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all"
              >
                Full setup instructions
              </a>
              <button
                onClick={() => {
                  setNoAgentError(false);
                  setPageState("role_select");
                }}
                className="px-6 py-2 text-sm text-zinc-400 hover:text-zinc-200 border border-white/10 hover:border-white/20 rounded-lg transition-colors"
              >
                Back to queue
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==================== ROLE SELECT ====================
  if (pageState === "role_select") {
    const joinAs = (eligible: boolean) => {
      setHostEligible(eligible);
      setPageState("queued");
      send({ type: "join_queue", hostEligible: eligible });
    };

    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="max-w-lg text-center space-y-8">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-zinc-100">Choose your role</h2>
              <p className="text-zinc-400 text-sm">
                One person hosts Claude Code on their machine. The other joins through the browser.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => router.push("/host?return=/queue")}
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

  // ==================== QUEUE ====================
  if (pageState === "connecting" || pageState === "queued") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-8">
            {pageState === "connecting" && (
              <div className="space-y-4">
                <div className="w-16 h-16 border-4 border-brand-400/30 border-t-brand-400 rounded-full animate-spin mx-auto" />
                <p className="text-gray-400">Connecting...</p>
              </div>
            )}

            {pageState === "queued" && (
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
          </div>
        </main>
      </div>
    );
  }

  // ==================== MATCHED (brief animation) ====================
  if (pageState === "matched" && partner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center space-y-6 animate-in">
          <div className="text-4xl font-bold text-brand-400">Matched!</div>
          <div className="flex items-center gap-4 justify-center">
            {user?.image && (
              <img src={user.image} alt="You" className="w-16 h-16 rounded-full border-2 border-brand-400" />
            )}
            <span className="text-2xl text-gray-500">&amp;</span>
            {partner.avatarUrl && (
              <img src={partner.avatarUrl} alt={partner.username} className="w-16 h-16 rounded-full border-2 border-brand-400" />
            )}
          </div>
          <p className="text-gray-300">
            Paired with <span className="font-semibold text-white">{partner.username}</span>
          </p>
          <p className="text-sm text-gray-500">Starting session...</p>
        </div>
      </div>
    );
  }

  // ==================== ENDED ====================
  if (pageState === "ended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="max-w-sm text-center space-y-6">
          <h1 className="text-2xl font-bold text-zinc-100">Session ended</h1>
          <p className="text-zinc-500">{endReason === "partner_left" ? "Your partner disconnected." : "Thanks for building together!"}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  // ==================== SESSION ====================
  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Session top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] bg-surface z-20">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">CR</span>
            </div>
          </div>
          <div className="w-[1px] h-5 bg-white/[0.06]" />
          {partner && (
            <div className="flex items-center gap-2.5">
              <div className="relative">
                {partner.avatarUrl && (
                  <img src={partner.avatarUrl} alt={partner.username} className="w-7 h-7 rounded-lg ring-1 ring-white/[0.06]" />
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-emerald border-2 border-surface" />
              </div>
              <div>
                <span className="text-[13px] font-medium text-zinc-200">{partner.username}</span>
                <span className="text-[11px] text-zinc-600 ml-2">online</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <RoleSwapButton
            isDriver={isDriver}
            isHost={isHost}
            swapRequested={swapRequested}
            swapRequestedBy={swapRequestedBy}
            onRequestSwap={() => send({ type: "request_role_swap" })}
            onConfirmSwap={(accepted) => {
              send({ type: "confirm_role_swap", accepted });
              setSwapRequested(false);
            }}
            onReclaimDriver={() => send({ type: "reclaim_driver" })}
          />
          <div className="w-[1px] h-5 bg-white/[0.06]" />
          <Timer
            endsAt={endsAt}
            extended={extended}
            onRequestExtend={() => send({ type: "request_extend" })}
          />
          <button
            onClick={() => setPageState("ended")}
            className="px-3 py-1.5 text-[12px] text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-all"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Terminal + Prompt */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Pending prompt approvals (shown to host) */}
          {pendingPrompts.length > 0 && (
            <div className="px-3 pt-2 space-y-2">
              {pendingPrompts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent-violet/10 border border-accent-violet/20 animate-slide-up">
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-accent-violet/60 block">{p.from} suggests:</span>
                    <span className="text-[13px] text-accent-violet break-words">{p.text}</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => {
                        send({ type: "approve_prompt", id: p.id });
                        setPendingPrompts((prev) => prev.filter((x) => x.id !== p.id));
                      }}
                      className="px-3 py-1.5 text-[11px] font-medium bg-accent-emerald/10 text-accent-emerald rounded-md hover:bg-accent-emerald/20 transition-colors"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => {
                        send({ type: "reject_prompt", id: p.id });
                        setPendingPrompts((prev) => prev.filter((x) => x.id !== p.id));
                      }}
                      className="px-3 py-1.5 text-[11px] font-medium bg-surface-overlay text-zinc-500 rounded-md hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className={`flex-1 p-3 ${isDriver ? "" : "pb-0"} min-h-0`}>
            <Terminal
              ref={terminalRef}
              className="h-full rounded-xl border border-white/[0.04]"
              welcomeMessage={isDriver
                ? "Session active — type directly in the terminal."
                : "Session active — suggest prompts in the input below."}
              onResize={(cols, rows) => {
                send({ type: "resize", cols, rows });
              }}
              onInput={(data) => {
                send({ type: "terminal_input", data });
              }}
            />
          </div>
          {!isDriver && (
            <PromptInput
              isDriver={false}
              driverInput={driverInput}
              onSubmit={(text) => {
                send({ type: "suggest_prompt", text });
              }}
            />
          )}
        </div>

        {/* Chat sidebar */}
        <div className="w-80 shrink-0">
          <ChatSidebar
            messages={chatMessages}
            partnerUsername={partner?.username}
            onSend={(text) => send({ type: "chat", text })}
            onPromptClick={isDriver ? (text) => {
              send({ type: "terminal_input", data: text });
            } : undefined}
          />
        </div>
      </div>
    </div>
  );
}
