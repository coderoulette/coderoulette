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

  const [role, setRole] = useState<Role>("navigator");
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [extended, setExtended] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
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
          terminalRef.current?.write(event.data);
          break;

        case "chat_message":
          setChatMessages((prev) => [...prev, event.message]);
          break;

        case "matched":
          setPartner(event.partner);
          setRole(event.role);
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
          setRole(
            event.newDriverId === user?.id ? "driver" : "navigator"
          );
          setSwapRequested(false);
          setSwapRequestedBy(undefined);
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

        case "error":
          // Could show a toast
          console.error("Server error:", event.message);
          break;
      }
    },
    [user?.id, router, sessionId]
  );

  const { send } = useWebSocket({
    userId: user?.id || "",
    username: user?.username || user?.name || "",
    avatarUrl: user?.image || "",
    onMessage,
  });

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
            <span className="text-brand-400">Claude</span>
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
            swapRequested={swapRequested}
            swapRequestedBy={swapRequestedBy}
            onRequestSwap={() => send({ type: "request_role_swap" })}
            onConfirmSwap={(accepted) =>
              send({ type: "confirm_role_swap", accepted })
            }
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
        <div className="flex-1 flex flex-col">
          <Terminal ref={terminalRef} className="flex-1" />
          <PromptInput
            isDriver={isDriver}
            onSubmit={(text) => send({ type: "prompt", text })}
          />
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
