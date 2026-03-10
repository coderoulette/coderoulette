"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Terminal, type TerminalHandle } from "@/components/Terminal";
import { ChatSidebar } from "@/components/ChatSidebar";
import { PromptInput } from "@/components/PromptInput";
import { Timer } from "@/components/Timer";
import { ProjectSuggestions } from "@/components/ProjectSuggestions";
import { RoleSwapButton } from "@/components/RoleSwapButton";
import type {
  ServerEvent,
  ChatMessage,
  ProjectIdea,
  Role,
} from "@clauderoulette/shared";

type DevState = "landing" | "queue" | "matched" | "session" | "ended";

const DEV_USERS = [
  { id: "dev-user-1", username: "alice_dev", avatarUrl: "https://api.dicebear.com/7.x/pixel-art/svg?seed=alice" },
  { id: "dev-user-2", username: "bob_coder", avatarUrl: "https://api.dicebear.com/7.x/pixel-art/svg?seed=bob" },
];

export default function DevPage() {
  const [state, setState] = useState<DevState>("landing");
  const [role, setRole] = useState<Role>("driver");
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [extended, setExtended] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [swapRequested, setSwapRequested] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [demoPrompts, setDemoPrompts] = useState<string[]>([]);

  const terminalRef = useRef<TerminalHandle>(null);
  const partner = DEV_USERS[1];
  const me = DEV_USERS[0];

  const projects: ProjectIdea[] = [
    { id: "1", title: "Git Log Poet", description: "CLI that turns your git commit history into a rhyming poem" },
    { id: "2", title: "Terminal Tarot", description: "CLI tarot card reader that gives coding-themed fortune readings" },
    { id: "3", title: "README Roaster", description: "Tool that reads a GitHub README and writes a comedic roast" },
  ];

  const connectWs = useCallback(() => {
    const url = `ws://localhost:3001?userId=${me.id}&username=${me.username}&avatarUrl=${encodeURIComponent(me.avatarUrl)}`;
    const socket = new WebSocket(url);
    socket.onopen = () => { setConnected(true); };
    socket.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ServerEvent;
        switch (event.type) {
          case "queue_joined": setState("queue"); break;
          case "matched":
            setState("matched");
            setRole(event.role);
            setTimeout(() => setState("session"), 2000);
            break;
          case "session_started": setState("session"); setEndsAt(event.endsAt); break;
          case "terminal_data": terminalRef.current?.write(event.data); break;
          case "chat_message": setChatMessages((prev) => [...prev, event.message]); break;
          case "role_swapped": setRole(event.newDriverId === me.id ? "driver" : "navigator"); setSwapRequested(false); break;
          case "role_swap_requested": setSwapRequested(true); break;
          case "session_ended": case "partner_left": setState("ended"); break;
          case "project_suggestions": setShowProjects(true); break;
          case "session_extended": setEndsAt(event.newEndsAt); setExtended(true); break;
        }
      } catch {}
    };
    socket.onclose = () => setConnected(false);
    setWs(socket);
    return socket;
  }, [me]);

  useEffect(() => { return () => { ws?.close(); }; }, [ws]);

  // ==================== LANDING ====================
  if (state === "landing") {
    return (
      <div className="min-h-screen bg-surface flex flex-col overflow-hidden">
        {/* Ambient background */}
        <div className="fixed inset-0 bg-radial-brand pointer-events-none" />
        <div className="fixed inset-0 bg-grid pointer-events-none" />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">CR</span>
            </div>
            <span className="text-[15px] font-bold text-zinc-100 tracking-tight">ClaudeRoulette</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-medium">DEV MODE</span>
          </div>
        </nav>

        {/* Hero */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 -mt-12">
          <div className="max-w-xl text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-raised border border-white/[0.06] rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
              <span className="text-[12px] text-zinc-400">Saturday Jam Sessions — 2pm EST & CET</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.1]">
              Build something<br />
              <span className="text-gradient">with a stranger</span>
            </h1>

            <p className="text-lg text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Get matched with a random dev. Share a Claude Code terminal. Ship something fun in 30 minutes.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  const socket = connectWs();
                  socket.onopen = () => {
                    setConnected(true);
                    socket.send(JSON.stringify({ type: "join_queue", hostEligible: true }));
                  };
                }}
                className="group relative px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-2xl text-lg transition-all glow-brand-lg hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="relative z-10">Find a partner</span>
              </button>

              <button
                onClick={() => {
                  const socket = connectWs();
                  socket.onopen = () => {
                    setConnected(true);
                    socket.send(JSON.stringify({ type: "solo_session" }));
                  };
                }}
                className="px-6 py-3 bg-accent-violet hover:bg-accent-violet/80 text-white font-semibold rounded-xl text-[14px] transition-all"
              >
                Solo session with Claude
              </button>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setState("session");
                    setRole("driver");
                    setEndsAt(new Date(Date.now() + 30 * 60 * 1000).toISOString());
                    setShowProjects(false);
                  }}
                  className="px-4 py-2 text-[13px] text-zinc-600 hover:text-zinc-300 rounded-lg hover:bg-surface-raised transition-all"
                >
                  Preview UI (offline)
                </button>
                <button
                  onClick={() => {
                    setState("session");
                    setRole("driver");
                    setEndsAt(new Date(Date.now() + 30 * 60 * 1000).toISOString());
                    setShowProjects(true);
                  }}
                  className="px-4 py-2 text-[13px] text-zinc-600 hover:text-zinc-300 rounded-lg hover:bg-surface-raised transition-all"
                >
                  Preview project picker
                </button>
              </div>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-3 gap-3 pt-4">
              {[
                { step: "01", title: "Match", desc: "Instant random pairing with another dev" },
                { step: "02", title: "Plan", desc: "Pick a fun project idea together" },
                { step: "03", title: "Ship", desc: "Co-drive Claude Code for 30 mins" },
              ].map((item) => (
                <div key={item.step} className="p-4 rounded-xl bg-surface-raised/50 border border-white/[0.04] text-left group hover:border-white/[0.08] transition-all">
                  <span className="text-[11px] font-mono text-zinc-700 group-hover:text-brand-500 transition-colors">{item.step}</span>
                  <h3 className="text-[14px] font-semibold text-zinc-200 mt-1">{item.title}</h3>
                  <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 py-6 text-center">
          <p className="text-[12px] text-zinc-700">Two humans + one Claude = magic</p>
        </footer>
      </div>
    );
  }

  // ==================== QUEUE ====================
  if (state === "queue") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="fixed inset-0 bg-radial-violet pointer-events-none" />
        <div className="relative text-center space-y-8 animate-fade-in">
          {/* Animated search indicator */}
          <div className="relative w-28 h-28 mx-auto">
            <div className="absolute inset-0 rounded-full border border-accent-violet/20 animate-pulse-ring" />
            <div className="absolute inset-2 rounded-full border border-accent-violet/15 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
            <div className="absolute inset-4 rounded-full border border-accent-violet/10 animate-pulse-ring" style={{ animationDelay: "1s" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-accent-violet/10 flex items-center justify-center backdrop-blur-sm border border-accent-violet/20">
                <svg className="w-6 h-6 text-accent-violet animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-zinc-100">Searching for a partner...</h2>
            <p className="text-[14px] text-zinc-500">Matching you with another developer</p>
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-accent-violet"
                style={{ animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>

          <button
            onClick={() => { setState("landing"); ws?.close(); setWs(null); }}
            className="px-5 py-2 text-[13px] text-zinc-600 hover:text-zinc-300 border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ==================== MATCHED ====================
  if (state === "matched") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="fixed inset-0 bg-radial-brand pointer-events-none" />
        <div className="relative text-center space-y-8 animate-scale-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent-emerald/10 text-accent-emerald text-[13px] font-semibold rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
            Matched!
          </div>

          <div className="flex items-center gap-6 justify-center">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-brand-500/30 ring-offset-2 ring-offset-surface">
                <img src={me.avatarUrl} alt="You" className="w-full h-full" />
              </div>
              <p className="text-[13px] text-zinc-400">{me.username}</p>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-[1px] bg-gradient-to-r from-brand-500/50 to-accent-violet/50" />
              <span className="text-[11px] text-zinc-600 font-mono">+</span>
              <div className="w-10 h-[1px] bg-gradient-to-r from-accent-violet/50 to-brand-500/50" />
            </div>

            <div className="text-center space-y-2">
              <div className="w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-accent-violet/30 ring-offset-2 ring-offset-surface">
                <img src={partner.avatarUrl} alt={partner.username} className="w-full h-full" />
              </div>
              <p className="text-[13px] text-zinc-400">{partner.username}</p>
            </div>
          </div>

          <p className="text-[14px] text-zinc-500">Loading session...</p>
        </div>
      </div>
    );
  }

  // ==================== ENDED ====================
  if (state === "ended") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="fixed inset-0 bg-radial-brand pointer-events-none" />
        <div className="relative max-w-sm text-center space-y-8 animate-fade-in">
          <div className="space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-white/[0.06] flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">Session complete</h1>
            <p className="text-[14px] text-zinc-500">Nice building with {partner.username}!</p>
          </div>

          {/* Partner card */}
          <div className="p-4 rounded-xl bg-surface-raised border border-white/[0.06] flex items-center gap-3">
            <img src={partner.avatarUrl} alt={partner.username} className="w-10 h-10 rounded-xl" />
            <div className="flex-1 text-left">
              <p className="text-[14px] font-semibold text-zinc-200">{partner.username}</p>
              <p className="text-[12px] text-zinc-600">Your jam partner</p>
            </div>
            <button className="px-3 py-1.5 text-[12px] font-medium text-zinc-400 bg-surface-overlay rounded-lg hover:text-zinc-200 transition-colors">
              Follow
            </button>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => { setState("landing"); ws?.close(); setWs(null); setChatMessages([]); }}
              className="w-full px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all glow-brand"
            >
              Find another partner
            </button>
            <button
              onClick={() => { setState("landing"); ws?.close(); setWs(null); setChatMessages([]); }}
              className="w-full px-6 py-3 text-[14px] text-zinc-600 hover:text-zinc-300 rounded-xl transition-colors"
            >
              Back to home
            </button>
          </div>
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
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">CR</span>
            </div>
          </div>

          {/* Separator */}
          <div className="w-[1px] h-5 bg-white/[0.06]" />

          {/* Partner info */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <img src={partner.avatarUrl} alt={partner.username} className="w-7 h-7 rounded-lg ring-1 ring-white/[0.06]" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-emerald border-2 border-surface" />
            </div>
            <div>
              <span className="text-[13px] font-medium text-zinc-200">{partner.username}</span>
              <span className="text-[11px] text-zinc-600 ml-2">online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <RoleSwapButton
            isDriver={role === "driver"}
            swapRequested={swapRequested}
            swapRequestedBy={swapRequested ? partner.username : undefined}
            onRequestSwap={() => {
              if (ws) ws.send(JSON.stringify({ type: "request_role_swap" }));
              else setRole(role === "driver" ? "navigator" : "driver");
            }}
            onConfirmSwap={(accepted) => {
              if (ws) ws.send(JSON.stringify({ type: "confirm_role_swap", accepted }));
              else if (accepted) setRole(role === "driver" ? "navigator" : "driver");
              setSwapRequested(false);
            }}
          />

          <div className="w-[1px] h-5 bg-white/[0.06]" />

          <Timer
            endsAt={endsAt}
            extended={extended}
            onRequestExtend={() => {
              if (ws) ws.send(JSON.stringify({ type: "request_extend" }));
              else {
                setEndsAt(new Date(new Date(endsAt!).getTime() + 15 * 60 * 1000).toISOString());
                setExtended(true);
              }
            }}
          />

          <button
            onClick={() => setState("ended")}
            className="px-3 py-1.5 text-[12px] text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-all"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Project picker overlay */}
        {showProjects && (
          <ProjectSuggestions
            projects={projects}
            votes={{}}
            onVote={(id, vote) => console.log("Vote:", id, vote)}
            onDismiss={() => setShowProjects(false)}
          />
        )}

        {/* Terminal + Prompt */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 p-3 pb-0 min-h-0">
            <Terminal
              ref={terminalRef}
              className="h-full rounded-xl border border-white/[0.04]"
              welcomeMessage="Session active — type a prompt below to start building together."
            />
          </div>
          {/* Demo prompt log (offline mode only) */}
          {!ws && demoPrompts.length > 0 && (
            <div className="px-3 py-2 border-t border-white/[0.04] bg-surface-raised/50 space-y-1.5 max-h-32 overflow-y-auto">
              {demoPrompts.map((p, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]">
                  <span className="text-brand-500 font-mono shrink-0">&gt;</span>
                  <span className="text-zinc-400 font-mono">{p}</span>
                  <span className="text-zinc-700 ml-auto shrink-0 italic">demo — no Claude connected</span>
                </div>
              ))}
            </div>
          )}
          <PromptInput
            isDriver={role === "driver"}
            onSubmit={(text) => {
              if (ws) {
                ws.send(JSON.stringify({ type: "prompt", text }));
              } else {
                setDemoPrompts((prev) => [...prev, text]);
                terminalRef.current?.writeRaw(`\r\n\x1b[38;5;208m>\x1b[0m ${text}\r\n\x1b[90m  [demo mode — no Claude connected]\x1b[0m\r\n`);
              }
            }}
          />
        </div>

        {/* Chat sidebar */}
        <div className="w-80 shrink-0">
          <ChatSidebar
            messages={chatMessages}
            partnerUsername={partner.username}
            onSend={(text) => {
              const msg: ChatMessage = {
                id: Date.now().toString(),
                sessionId: "dev",
                userId: me.id,
                username: me.username,
                avatarUrl: me.avatarUrl,
                text,
                timestamp: new Date().toISOString(),
              };
              setChatMessages((prev) => [...prev, msg]);
              if (ws) ws.send(JSON.stringify({ type: "chat", text }));
            }}
          />
        </div>
      </div>
    </div>
  );
}
