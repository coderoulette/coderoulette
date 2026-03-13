# CodeRoulette Vision

> Pair program with a stranger. Two humans + one AI agent. Build something fun in 30 minutes.

---

## The Problem

Coding is often a solitary activity. Developers who want spontaneous, low-stakes collaboration with someone new have no easy way to find a partner and start building together.

- **Why does this matter?** Developers enjoy pair programming and social coding, but the friction to find a partner is high. Hackathons solve this but happen rarely. CodeRoulette makes it instant and casual.
- **Evidence:** The popularity of Omegle-style random pairing, hackathon culture, and the rise of social coding on Twitch/Discord all point to demand for spontaneous developer collaboration.
- **Why now?** Claude Code makes AI-assisted development collaborative in a new way — two humans + one AI agent is a novel and fun dynamic that didn't exist before.

## The Approach

A web app where developers log in with GitHub, get randomly matched, and share a single Claude Code terminal session. Both participants collaborate on prompts before they're sent to Claude. Sessions are timeboxed to 30 minutes.

The host runs a lightweight CLI agent (`npx coderoulette-host`) that spawns Claude Code in a PTY and streams terminal output over WebSocket to a relay server. Both users see the same terminal rendered via xterm.js in the browser.

### Why this architecture?

We considered and rejected several alternatives:

| Alternative | Why we didn't use it |
|---|---|
| VS Code Live Share | Too heavy — requires IDE setup from both sides |
| Cloud-hosted dev environment | Expensive and complex for V1 |
| Text chat + separate Claude sessions | Loses the magic of truly co-developing |
| ttyd/gotty on host | Requires port exposure, no consent layer |

The custom relay architecture keeps outbound-only connections from the host (no port exposure), gives full control over what gets streamed, and lets us build the consent system server-side.

### A Typical Session

**Alex** is a backend developer in Berlin. It's Saturday afternoon — CodeRoulette's weekly "Jam Session" hour. They open CodeRoulette, hit "Find a partner," and get matched with **Sam**, a frontend developer in Toronto. The app suggests three fun project ideas — they pick "CLI tool that generates ASCII art from GitHub contribution graphs." Alex is selected as host; the terminal loads in seconds. They take turns driving Claude, riffing on each other's ideas. 30 minutes later they have a working prototype and a new GitHub connection.

---

## Goals

1. **Make it fun** — the primary metric is enjoyment, not productivity
2. **Time-to-match < 60 seconds** during scheduled roulette hours
3. **Session completion rate > 50%** — median session duration > 20 minutes
4. **Zero-friction start** — GitHub login to matched session in under 2 minutes
5. **Organic growth** — users share what they built after each session

## Non-Goals

1. **Persistent projects** — this is for throwaway jams, not long-term collaboration
2. **Skill matching** — V1 is pure roulette. Randomness is the point.
3. **Code hosting/deployment** — we don't store or deploy what you build
4. **Video/voice chat** — text communication via chat sidebar is enough for V1
5. **Mobile support** — a shared terminal session isn't usable on a phone

---

## Core Features

### Matchmaking

Simple FIFO queue. "Find a partner" enters the queue, matches the next available person. One user is selected as host based on WebSocket latency. Users can opt out of hosting.

### Driver/Navigator Collaboration

Instead of requiring dual-consent on every prompt (which kills creative flow), CodeRoulette uses a Driver/Navigator model:

- The **driver** types prompts into a dedicated input field. Prompts go to Claude Code immediately.
- The **navigator** watches the terminal and suggests prompts via chat.
- Either user can **request a role swap** at any time. One click to confirm.

This mirrors real pair programming — maintains momentum while giving both users agency.

### Safety Without Dual-Consent

- Claude Code's built-in permission system prompts the host before running commands or writing files
- The host is always the final gatekeeper — nothing executes without their approval
- Both users see permission prompts in the shared terminal
- Keyword warnings flag prompts that reference sensitive paths (`.ssh`, `.env`, credentials)

### Session Lifecycle

- **30-minute timer** with visible countdown
- **15-minute check-in** — "Both enjoying this? Keep going?"
- **5-minute warning** banner
- **Optional +15 minute extension** (once, requires both users)
- **No-fault re-match** — either user can try a different match in the first 3 minutes

### Direct Invite Links

Share a link with a friend for a guaranteed match. Gets people in the door even when no strangers are online. Every direct-invite session is a potential conversion to roulette mode.

---

## Host Agent

The host agent (`coderoulette-host`) is a first-class product component, not an implementation detail.

**What it does:**
1. Spawns Claude Code in a PTY within an isolated working directory
2. Captures terminal output and sends it over WebSocket to the relay server
3. Receives approved prompts and writes them to Claude Code's stdin
4. Buffers output during brief disconnections and replays on reconnect

**Security constraints:**
- Outbound WebSocket only — no ports exposed
- Isolated working directory — never runs in your home directory
- Open-source and auditable
- Claude Code runs with its standard permission system — every command needs host approval

**Installation:**
```bash
npx coderoulette-host
```

Single command. Platform support: macOS, Linux, Windows via WSL.

---

## Architecture

```
Host Machine              Relay Server              Both Browsers
+--------------+         +--------------+         +--------------+
| Claude Code  |         | WebSocket Hub|         | xterm.js     |
|   (in PTY)   |         | - Matchmaking|         | terminal view|
|      |       |   WS    | - Prompt mgmt|   WS    |              |
| Host Agent   |-------->| - Byte relay |<--------|  Next.js App |
| (node-pty)   |         | - Chat/Timer |         |              |
+--------------+         +--------------+         +--------------+
```

**Tech stack:**
- **Server:** Node.js + Express + ws. TypeScript.
- **Frontend:** Next.js 15 + React 19. xterm.js for terminal. Tailwind CSS.
- **Host Agent:** Node.js CLI via npm. node-pty for Claude Code spawning.
- **Auth:** GitHub OAuth via NextAuth + JWT for WebSocket connections.

**V1 simplifications:**
- Single server, no microservices
- In-memory matchmaking queue (no Redis)
- No horizontal scaling or container orchestration
- The relay interface is designed so "host agent sends terminal bytes" can later become "cloud container sends terminal bytes" with no frontend changes

---

## Security Model

### Threat: Malicious prompts

A driver sends a prompt like "Read ~/.ssh/id_rsa." Claude Code runs in an isolated working directory and will prompt the host before accessing files outside it. Keyword warnings flag suspicious paths.

### Threat: Claude Code tool use

Claude Code can execute shell commands and make network requests. Every command execution requires explicit host approval in the terminal. The host is the gatekeeper.

### Threat: Terminal escape sequence injection

xterm.js provides hardening against malicious escape sequences. The relay server forwards raw PTY bytes.

### Threat: Host agent as attack surface

Outbound WebSocket only. Open-source and auditable. Minimal scope — a thin PTY wrapper, not a general-purpose tool.

---

## Cold Start Strategy

The product requires concurrent users. This is the existential risk.

1. **Scheduled roulette hours** — V1 runs at fixed times (Saturdays at 2pm EST and 2pm CET). Concentrate users into windows where matches are guaranteed. Market it as an event ("Saturday Jam Session").
2. **Direct invite links** — utility even with zero strangers online.
3. **Post-session sharing** — prompt both users to share what they built. Make virality effortless.
4. **Community partnerships** — organized CodeRoulette nights with coding Discord servers.

---

## Future Directions

- Skill/interest filters and matchmaking preferences
- Voice/video chat integration
- Cloud-hosted environments (no host machine needed)
- Session recordings and replays
- Leaderboards, streaks, achievements
- Spectator mode — watch live sessions
- Solo mode — "Play with AI" when no match is available
- Enterprise/education — private roulette pools for teams and bootcamps

---

## FAQ

**Why not just use VS Code Live Share?**
CodeRoulette is about the spontaneous matchmaking + AI-assisted building experience, not just screen sharing. The roulette mechanic and collaborative Claude interaction are the product.

**What if nobody is online?**
V1 runs at scheduled times to concentrate users. Direct invite links let you pair with a friend anytime.

**Is my machine safe as a host?**
Claude Code runs in an isolated directory. Every command needs your approval. The host agent is open-source. See the Security Model section.

**What do I need to be a host?**
Claude Code installed, stable internet, and `npx coderoulette-host` running. macOS or Linux (Windows via WSL).
