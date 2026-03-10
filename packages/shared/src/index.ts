// =============================================
// Types
// =============================================

export interface User {
  id: string;
  githubId: number;
  username: string;
  avatarUrl: string;
  displayName: string;
  createdAt: string;
  isBanned: boolean;
}

export type SessionStatus = "waiting" | "active" | "completed" | "abandoned";
export type Role = "driver" | "navigator";

export interface Session {
  id: string;
  hostId: string;
  guestId: string;
  status: SessionStatus;
  driverId: string;
  startedAt: string;
  endsAt: string;
  endedAt?: string;
  extended: boolean;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  username: string;
  avatarUrl: string;
  text: string;
  timestamp: string;
}

export type MatchState = "idle" | "queued" | "matched" | "active" | "ended";

export interface QueueEntry {
  userId: string;
  username: string;
  avatarUrl: string;
  hostEligible: boolean;
  latencyMs: number;
  joinedAt: number;
  inviteCode?: string;
}

// Client -> Server
export type ClientEvent =
  | { type: "join_queue"; hostEligible: boolean; inviteCode?: string }
  | { type: "leave_queue" }
  | { type: "prompt"; text: string }
  | { type: "chat"; text: string }
  | { type: "request_role_swap" }
  | { type: "confirm_role_swap"; accepted: boolean }
  | { type: "vote_project"; projectId: string; vote: "up" | "down" }
  | { type: "request_rematch" }
  | { type: "request_extend" }
  | { type: "confirm_extend"; accepted: boolean }
  | { type: "checkin_response"; continueSession: boolean }
  | { type: "solo_session" }
  | { type: "ping" };

// Server -> Client
export type ServerEvent =
  | { type: "queue_joined"; position: number }
  | { type: "queue_update"; position: number }
  | {
      type: "matched";
      sessionId: string;
      partner: { username: string; avatarUrl: string; githubId: number };
      role: Role;
      isHost: boolean;
    }
  | { type: "session_started"; endsAt: string }
  | { type: "terminal_data"; data: string }
  | { type: "chat_message"; message: ChatMessage }
  | { type: "role_swap_requested"; by: string }
  | { type: "role_swapped"; newDriverId: string }
  | { type: "time_warning"; remainingMs: number }
  | { type: "checkin"; message: string }
  | { type: "extend_requested"; by: string }
  | { type: "session_extended"; newEndsAt: string }
  | {
      type: "session_ended";
      reason: "timer" | "partner_left" | "rematch" | "checkin_declined";
    }
  | { type: "partner_left" }
  | { type: "rematch_requested" }
  | { type: "project_suggestions"; projects: ProjectIdea[] }
  | {
      type: "project_votes";
      votes: Record<string, { up: number; down: number }>;
    }
  | { type: "error"; message: string }
  | { type: "pong" };

// Host Agent -> Server
export type AgentEvent =
  | { type: "agent_ready"; sessionId: string }
  | { type: "terminal_output" }
  | { type: "agent_disconnected" };

// Server -> Host Agent
export type AgentCommand =
  | { type: "start_session"; sessionId: string; workDir?: string }
  | { type: "send_prompt"; text: string }
  | { type: "end_session" };

export interface ProjectIdea {
  id: string;
  title: string;
  description: string;
}

// =============================================
// Constants
// =============================================

export const SESSION_DURATION_MS = 30 * 60 * 1000;
export const EXTENSION_DURATION_MS = 15 * 60 * 1000;
export const CHECKIN_AT_MS = 15 * 60 * 1000;
export const WARNING_AT_MS = 5 * 60 * 1000;
export const REMATCH_WINDOW_MS = 3 * 60 * 1000;
export const RECONNECT_GRACE_MS = 60 * 1000;

export const MAX_SESSIONS_PER_DAY = 5;

export const WS_PING_INTERVAL_MS = 15 * 1000;
export const WS_PONG_TIMEOUT_MS = 10 * 1000;

export const SENSITIVE_PATH_PATTERNS = [
  /\.ssh/i,
  /\.env/i,
  /\.aws/i,
  /credentials/i,
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /\.gnupg/i,
  /\.npmrc/i,
  /token/i,
  /secret/i,
  /private.key/i,
  /id_rsa/i,
  /id_ed25519/i,
];

export function checkPromptSafety(prompt: string): string[] {
  const warnings: string[] = [];
  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(prompt)) {
      warnings.push(
        `Prompt references a potentially sensitive path matching: ${pattern.source}`
      );
    }
  }
  return warnings;
}

// =============================================
// Project Ideas
// =============================================

export const PROJECT_IDEAS: ProjectIdea[] = [
  {
    id: "ascii-contrib",
    title: "GitHub Contribution ASCII Art",
    description:
      "CLI tool that fetches your GitHub contribution graph and renders it as ASCII art",
  },
  {
    id: "excuse-api",
    title: "Standup Excuse Generator",
    description:
      "API that returns a random creative excuse for missing standup meetings",
  },
  {
    id: "git-poem",
    title: "Git Log Poet",
    description: "CLI that turns your git commit history into a rhyming poem",
  },
  {
    id: "cli-tarot",
    title: "Terminal Tarot",
    description:
      "CLI tarot card reader that gives coding-themed fortune readings",
  },
  {
    id: "readme-roast",
    title: "README Roaster",
    description:
      "Tool that reads a GitHub README and writes a comedic roast of the project",
  },
  {
    id: "regex-explain",
    title: "Regex Explainer",
    description:
      "CLI that takes a regex and explains it in plain English, step by step",
  },
  {
    id: "color-name",
    title: "Color Name Inventor",
    description:
      "API that generates creative names for any hex color (like paint swatches)",
  },
  {
    id: "dep-judge",
    title: "Dependency Judge",
    description:
      "CLI that reads your package.json and judges each dependency with a snarky one-liner",
  },
  {
    id: "commit-msg-ai",
    title: "Commit Message Rater",
    description:
      "Git hook that rates your commit messages on a scale of 1-10 with feedback",
  },
  {
    id: "ascii-webcam",
    title: "ASCII Webcam",
    description:
      "Terminal app that captures webcam frames and displays them as live ASCII art",
  },
  {
    id: "url-haiku",
    title: "URL Haiku",
    description:
      "URL shortener that generates haiku-formatted short URLs instead of random strings",
  },
  {
    id: "code-smell",
    title: "Code Smell Detector",
    description:
      "CLI that sniffs out code smells and describes them like a wine sommelier",
  },
  {
    id: "terminal-pet",
    title: "Terminal Pet",
    description:
      "A virtual pet that lives in your terminal and reacts to your coding habits",
  },
  {
    id: "pr-tldr",
    title: "PR TLDR",
    description:
      "CLI that reads a GitHub PR diff and generates a one-paragraph summary",
  },
  {
    id: "typing-race",
    title: "Code Typing Race",
    description:
      "Terminal-based typing speed game using real code snippets from famous repos",
  },
  {
    id: "emoji-commit",
    title: "Emoji Commit Translator",
    description:
      "CLI that translates conventional commit messages into all-emoji versions",
  },
  {
    id: "npm-roulette",
    title: "NPM Roulette",
    description:
      "CLI that installs a random npm package and tells you what it does",
  },
  {
    id: "stack-overflow-battle",
    title: "Stack Overflow Battle",
    description:
      "Two-player CLI game where you compete to answer Stack Overflow questions faster",
  },
  {
    id: "json-art",
    title: "JSON Art Gallery",
    description:
      "Web app that renders JSON data structures as abstract visual art",
  },
  {
    id: "changelog-story",
    title: "Changelog Storyteller",
    description:
      "CLI that reads a CHANGELOG.md and narrates the project history as a dramatic saga",
  },
  {
    id: "api-fortune",
    title: "HTTP Status Fortune Teller",
    description:
      "API that returns your fortune based on an HTTP status code you send it",
  },
  {
    id: "css-battle",
    title: "CSS Battle Mini",
    description:
      "Terminal tool that shows a target image and challenges you to match it with minimal CSS",
  },
  {
    id: "function-namer",
    title: "Function Name Generator",
    description:
      "API that generates increasingly absurd but descriptive function names for any task",
  },
  {
    id: "env-detective",
    title: "Env Detective",
    description:
      "CLI that analyzes your .env.example and suggests which services you probably use",
  },
  {
    id: "retro-terminal",
    title: "Retro Terminal Emulator",
    description:
      "Web app that makes any CLI tool look like it's running on an 80s CRT monitor",
  },
];

export function getRandomProjects(count = 3): ProjectIdea[] {
  const shuffled = [...PROJECT_IDEAS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
