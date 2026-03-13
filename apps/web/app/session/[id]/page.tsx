"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Terminal, type TerminalHandle } from "@/components/Terminal";
import { ChatSidebar } from "@/components/ChatSidebar";
import { PromptInput } from "@/components/PromptInput";
import { Timer } from "@/components/Timer";
import { ProjectSuggestions } from "@/components/ProjectSuggestions";
import { RoleSwapButton } from "@/components/RoleSwapButton";
import { useWebSocket } from "@/hooks/useWebSocket";
import type {
  ServerEvent,
  ChatMessage,
  ProjectIdea,
  Role,
} from "@clauderoulette/shared";
import { REMATCH_WINDOW_MS } from "@clauderoulette/shared";

export default function SessionPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const terminalRef = useRef<TerminalHandle>(null);
  const terminalBufferRef = useRef<string[]>([]);

  const [role, setRole] = useState<Role>("navigator");
  const [isHost, setIsHost] = useState(false);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [extended, setExtended] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingPrompts, setPendingPrompts] = useState<{ id: string; text: string; from: string }[]>([]);
  const [partner, setPartner] = useState<{
    username: string;
    avatarUrl: string;
  } | null>(null);

  // Project suggestions
  const [projects, setProjects] = useState<ProjectIdea[]>([]);
  const [projectVotes, setProjectVotes] = useState<
    Record<string, { up: number; down: number }>
  >({});
  const [showProjects, setShowProjects] = useState(false);

  // Role swap
  const [swapRequested, setSwapRequested] = useState(false);
  const [swapRequestedBy, setSwapRequestedBy] = useState<string>();

  // Rematch
  const [canRematch, setCanRematch] = useState(true);
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(0);

  // Driver input mirroring for navigator
  const [driverInput, setDriverInput] = useState("");

  const user = session?.user as
    | { id?: string; username?: string; name?: string; image?: string }
    | undefined;

  const onMessage = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case "session_started":
          setEndsAt(event.endsAt);
          setSessionStartedAt(Date.now());
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

        case "matched":
          setPartner(event.partner);
          setRole(event.role);
          setIsHost(event.isHost && event.hostEligible);
          break;

        case "project_suggestions":
          setProjects(event.projects);
          setShowProjects(true);
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

        case "time_warning":
          // Terminal already handles display
          break;

        case "session_extended":
          setEndsAt(event.newEndsAt);
          setExtended(true);
          break;

        case "session_ended":
          router.push(`/session-end/${sessionId}?reason=${event.reason}`);
          break;

        case "partner_left":
          router.push(`/session-end/${sessionId}?reason=partner_left`);
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
          // Could show a toast
          console.error("Server error:", event.message);
          break;
      }
    },
    [user?.id, router, sessionId]
  );

  const { send } = useWebSocket({
    enabled: !!user?.id,
    onMessage,
    onOpen: () => {
      send({ type: "join_session", sessionId });
    },
  });

  // Flush buffered terminal data once terminal mounts
  const [termMounted, setTermMounted] = useState(false);
  useEffect(() => {
    if (terminalRef.current && !termMounted) {
      setTermMounted(true);
      if (terminalBufferRef.current.length > 0) {
        const buf = terminalBufferRef.current;
        terminalBufferRef.current = [];
        setTimeout(() => {
          for (const data of buf) {
            terminalRef.current?.write(data);
          }
        }, 100);
      }
    }
  }, [termMounted]);

  // Disable rematch after 3 minutes
  useEffect(() => {
    if (!sessionStartedAt) return;
    const timeout = setTimeout(() => {
      setCanRematch(false);
    }, REMATCH_WINDOW_MS);
    return () => clearTimeout(timeout);
  }, [sessionStartedAt]);

  const isDriver = role === "driver";

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-surface-raised">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold">
            <span className="text-brand-400">Code</span>
            <span className="text-gray-400">Roulette</span>
          </span>
          {partner && (
            <div className="flex items-center gap-2">
              <img
                src={partner.avatarUrl}
                alt={partner.username}
                className="w-6 h-6 rounded-full"
              />
              <span className="text-sm text-gray-300">
                {partner.username}
              </span>
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
            onConfirmSwap={(accepted) =>
              send({ type: "confirm_role_swap", accepted })
            }
            onReclaimDriver={() => send({ type: "reclaim_driver" })}
          />
          <Timer
            endsAt={endsAt}
            extended={extended}
            onRequestExtend={() => send({ type: "request_extend" })}
          />
          {canRematch && (
            <button
              onClick={() => send({ type: "request_rematch" })}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Try a different match
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Project suggestions overlay */}
        {showProjects && projects.length > 0 && (
          <ProjectSuggestions
            projects={projects}
            votes={projectVotes}
            onVote={(projectId, vote) =>
              send({ type: "vote_project", projectId, vote })
            }
            onDismiss={() => setShowProjects(false)}
          />
        )}

        {/* Terminal area */}
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
              onResize={(cols, rows) => send({ type: "resize", cols, rows })}
              onInput={(data) => {
                send({ type: "terminal_input", data });
              }}
            />
          </div>
          {!isDriver && (
            <PromptInput
              isDriver={false}
              driverInput={driverInput}
              onSubmit={(text) => send({ type: "suggest_prompt", text })}
            />
          )}
        </div>

        {/* Chat sidebar */}
        <div className="w-80">
          <ChatSidebar
            messages={chatMessages}
            partnerUsername={partner?.username}
            onSend={(text) => send({ type: "chat", text })}
          />
        </div>
      </div>
    </div>
  );
}
