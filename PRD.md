# ClaudeRoulette PRD

## Changelog

- 2026-03-09: Initial draft
- 2026-03-09: V2 — incorporated exec, user research, and engineering reviews. Added: strategic value, host agent spec, security model, cold start strategy, architecture, business model, updated consent UX, re-match flow, shared artifacts.

---

# Problem Alignment

## Problem & Opportunity

Coding is often a solitary activity. Developers who want spontaneous, low-stakes collaboration with someone new have no easy way to find a partner and start building together. ClaudeRoulette pairs strangers for fun, timeboxed co-development sessions powered by Claude Code.

- **Why does this matter?** Developers enjoy pair programming and social coding but the friction to find a partner is high. Hackathons solve this but happen rarely. ClaudeRoulette makes it instant and casual.
- **Evidence:** The popularity of Omegle-style random pairing (video chat), Hackathon culture, and the rise of social coding on Twitch/Discord all point to demand for spontaneous developer collaboration.
- **Why now?** Claude Code makes AI-assisted development collaborative in a new way — two humans + one AI agent is a novel and fun dynamic that didn't exist before.

## Strategic Value

- **Claude Code adoption flywheel:** Every session puts Claude Code in front of a new developer. The non-host gets a zero-friction demo without installing anything.
- **Developer community and brand:** Positions the product as investing in developer joy, not just productivity tooling. A brand play as much as a product play.
- **Collaborative AI data:** Generates paired-developer interaction data with Claude that is qualitatively different from solo usage — useful for understanding collaborative AI workflows.

## High Level Approach

A web app where developers log in with GitHub, get randomly matched with another developer, and share a single Claude Code terminal session. Both participants collaborate on prompts before they're sent to Claude. Sessions are timeboxed to 30 minutes.

The host runs a lightweight CLI agent (`npx clauderoulette-host`) that spawns Claude Code in a PTY and streams terminal output over WebSocket to a relay server. Both users see the same terminal rendered via xterm.js in the browser.

**Alternatives considered:**
- Shared VS Code Live Share — too heavy, requires IDE setup from both sides
- Cloud-hosted dev environment — expensive, complex infrastructure for V1 (planned for V1.5 if host model proves problematic)
- Text chat + separate Claude sessions — loses the magic of truly co-developing
- ttyd/gotty directly on host — requires port exposure, no built-in consent layer, not production-grade

We landed on a custom relay architecture because it keeps outbound-only connections from the host (no port exposure), gives us full control over what gets streamed, and lets us build the consent system server-side.

### Narrative

**Alex** is a backend developer in Berlin. It's Saturday afternoon — ClaudeRoulette's weekly "Jam Session" hour. They want to code something fun but don't have a specific idea. They open ClaudeRoulette, hit "Find a partner," and get matched with **Sam**, a frontend developer in Toronto. The app suggests three fun project ideas — they pick "CLI tool that generates ASCII art from GitHub contribution graphs." Alex is selected as host; since they already have the host agent running, the terminal loads in seconds. They take turns driving Claude, riffing on each other's ideas. 30 minutes later they have a working prototype saved as a shared GitHub gist and a new GitHub connection.

## Goals

1. **Make it fun** — NPS > 50 in post-session survey; 70%+ of users who complete a session re-queue within 7 days
2. **Time-to-match < 60 seconds** during scheduled roulette hours
3. **Session completion rate > 50%** — median session duration > 20 minutes
4. **Zero-friction start** — GitHub login to matched session in under 2 minutes (for users with host agent pre-installed)
5. **Closed beta target** — 50 beta users, 200+ completed sessions in first 2 weeks
6. **Retention** — 30% week-1 retention (user returns for a second session within 7 days)
7. **Organic growth** — 20% of new users arrive via referral or social share
8. **Guardrail:** No code executes on the host machine without the host explicitly approving it through Claude Code's built-in permission system

## Non-goals

1. **Persistent projects** — this is for throwaway jams, not long-term collaboration. If people want to continue, they exchange GitHub handles.
2. **Skill matching** — V1 is pure roulette. No filters by language, skill level, or interest. Randomness is the point.
3. **Code hosting/deployment** — we don't store or deploy what they build (other than the optional end-of-session gist).
4. **Video/voice chat** — out of scope for V1. Text communication via chat sidebar is enough.
5. **Mobile support** — V1 is desktop-only. A shared terminal session is not usable on a phone screen.

---

# Solution Alignment

## Key Features

### Plan of record (V1)

1. **GitHub OAuth login** — sign in with GitHub. Display username, avatar, and public profile link as identity.
2. **Matchmaking queue** — "Find a partner" button enters a queue. Simple FIFO. Only users with the host agent running are eligible to be selected as host.
3. **Host selection** — one of the two matched users is selected as host, preferring the user with lower WebSocket latency to the relay server. Users may opt out of hosting (non-host-only mode).
4. **Host agent (`clauderoulette-host`)** — a CLI tool distributed via npm that the host runs locally. It spawns Claude Code in a PTY within a designated working directory, streams terminal bytes to the relay server over WebSocket, and writes approved prompts to Claude Code's stdin. See "Host Agent" section below.
5. **Shared terminal view** — both users see the host's Claude Code session rendered via xterm.js in the browser, streamed through the relay server in real-time.
6. **Driver/Navigator collaboration** — one user is the "driver" who can propose prompts. Either user can request to swap the driver role. The navigator can suggest prompts via the chat sidebar. See "Collaboration Model" section below.
7. **Chat sidebar** — simple text chat next to the terminal for coordination ("want to build X?", "nice idea", etc.)
8. **Project suggestion deck** — after matching, both users are shown 3-5 random fun project ideas to vote on (thumbs up/down). Helps solve the "blank canvas" problem. Users can also ignore suggestions and discuss their own idea in chat.
9. **30-minute timer** — visible countdown. 15-minute check-in ("Both enjoying this? Keep going?"). 5-minute warning. Session ends automatically. Both users can agree to extend by 15 minutes (once).
10. **No-fault re-match** — in the first 3 minutes, either user can click "Try a different match." Both get re-queued, no report needed.
11. **Session end screen** — shows partner's GitHub profile, option to follow, one-click "Share what we built" (auto-generates a tweet/post with screenshot), and a "Find another partner" button.
12. **Shared artifact** — at session end, auto-create a GitHub gist with everything built during the session. Both users get credit as collaborators.
13. **Direct invite links** — share a link with a friend for a direct match (bypasses the queue). Does not undermine the roulette concept — gets people in the door.

### Future considerations

- Skill/interest filters and matchmaking preferences
- Voice/video chat integration
- Cloud-hosted environments (no host machine needed) — **fast-follow to V1 if host acceptance rate < 60%**
- Session recordings/replays
- Leaderboards, streaks, achievements
- "Spectator mode" — watch live sessions
- "Play with AI" solo fallback when no match is available

### Host Agent

The host agent (`clauderoulette-host`) is a first-class product component, not an implementation detail.

**What it does:**
1. Spawns Claude Code in a PTY (pseudo-terminal) within a user-designated working directory (defaults to a fresh temp directory)
2. Captures PTY output byte stream and sends it over WebSocket to the relay server
3. Receives approved prompts from the relay server and writes them to Claude Code's stdin
4. Buffers PTY output during brief disconnections and replays on reconnect

**Security constraints enforced by the host agent:**
- Forces Claude Code to run **without auto-approve**, regardless of the host's personal settings
- Starts Claude Code in an **isolated working directory** — not the host's home directory
- Outbound WebSocket connection only — no ports exposed on the host machine
- Open-source and auditable. Signed releases. Pinned dependencies.

**Installation and setup:**
```
npx clauderoulette-host
```
Single command. Authenticates via the same GitHub OAuth token from the web app. Pre-requisite: Claude Code must be installed. The web app checks host agent status before allowing a user to enter the queue as host-eligible.

**Platform support (V1):** macOS, Linux. Windows via WSL.

### Collaboration Model

V1 uses a **Driver/Navigator** model instead of dual-consent on every prompt:

- After matching, the host starts as the driver by default.
- The **driver** types prompts into a dedicated input field in the web app (not directly into the terminal). Prompts are sent to Claude Code immediately.
- The **navigator** watches the terminal and communicates via chat. They can suggest prompts in chat for the driver to use.
- Either user can **request a role swap** at any time. The other user confirms with one click. Swap is instant.
- Both users can see the full terminal output at all times.

**Why not dual-consent on every prompt?**
Prototype testing showed that propose-wait-approve on every single prompt breaks creative flow. The driver/navigator pattern mirrors real pair programming, maintains momentum, and still gives both users agency through role swapping and chat suggestions.

**Safety without dual-consent:**
- Claude Code's built-in permission system still prompts the host for approval before running shell commands, writing files, etc. Both users see these permission prompts in the shared terminal.
- The host (who owns the machine) is always the final gatekeeper — Claude Code won't execute anything destructive without the host's local approval.
- The navigator can flag concerns via chat at any time.

### Key Flows

**Flow 0: Host agent setup (one-time)**

```
Install Claude Code (if not already) → Run `npx clauderoulette-host` →
Authenticate with GitHub → Agent starts, ready for sessions
```

**Flow 1: Match and Start**

```
Login (GitHub) → Landing page → "Find a partner" → Waiting for match →
Matched! (see partner's GitHub profile + project suggestions) →
Vote on project idea or chat about what to build →
Host agent connects, terminal loads → Start prompting Claude
```

**Flow 2: Driving and navigating**

```
Driver types prompt in input field → Prompt sent to Claude →
Output streams to both users → Navigator suggests next step in chat →
Navigator requests driver swap → Driver confirms → Roles switch
```

**Flow 3: Session end**

```
15-min check-in ("Keep going?") → 5-min warning banner →
Timer hits 0 → "Session complete!" screen →
GitHub gist auto-created with session output →
Partner's GitHub profile displayed →
"Follow on GitHub" / "Share what we built" / "Find another partner"
```

### Key Logic

1. **Host selection prefers lower latency** — WebSocket round-trip measured during matchmaking. User with <200ms latency preferred. If both qualify, coin flip. Users can opt out of hosting entirely.
2. **Host agent must be running before queuing** — the web app verifies agent connectivity. No "install now" delay after matching.
3. **Either user can leave early** — the other gets a "Partner left" message and option to re-queue.
4. **No-fault re-match** — available in the first 3 minutes. Either user clicks, both re-queue. Framed positively ("Try a different match"), no report needed.
5. **Reconnection window** — if host connection drops, 60-second grace period. Host agent buffers PTY output and replays on reconnect. Session only terminates after the window expires.
6. **Rate limiting** — max 5 sessions per user per day in V1 to prevent abuse.
7. **Reporting** — either user can report the other (abusive chat, harmful prompts). Reported users get reviewed before their next match.
8. **Claude Code permissions are the safety layer** — Claude Code already asks for confirmation before running commands or writing files. The host sees and approves these in real-time. Both users see the permission prompts in the shared terminal view.
9. **Working directory is isolated** — Claude Code runs in a fresh temp directory or a host-designated folder, never the host's home directory. The host is informed of this during setup.
10. **Prompt keyword warnings** — if a prompt references sensitive paths (`.ssh`, `.env`, `/etc/passwd`, credentials), the driver sees a warning before sending. Not a block — just a heads-up.

### Security Model

This section defines product-level security decisions, not just engineering implementation.

**Threat 1: Malicious prompts**
A driver sends a prompt like "Read ~/.ssh/id_rsa and print it." Claude Code runs in an isolated working directory and its built-in permission system will prompt the host before accessing files outside that directory. Additionally, keyword warnings flag suspicious paths.

**Threat 2: Claude Code tool use**
Claude Code can execute shell commands and make network requests. The host agent forces `--no-auto-approve` mode, so every command execution requires explicit host approval in the terminal. The host is the gatekeeper.

**Threat 3: Terminal escape sequence injection**
The relay server sanitizes the PTY byte stream before forwarding to clients, stripping sequences outside a known-safe set. xterm.js provides additional hardening.

**Threat 4: Host agent as attack surface**
The agent opens an outbound WebSocket only. It is open-source, auditable, with signed releases and pinned dependencies. Minimal scope — it is a thin PTY wrapper, not a general-purpose tool.

**Hard rule: Security review is a launch blocker.** The security spike and at least one external review of the host agent must be completed before any user-facing beta.

---

# Architecture

## V1 System Architecture

```
Host Machine              Relay Server              Both Browsers
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Claude Code  │         │ WebSocket Hub│         │ xterm.js     │
│   (in PTY)   │         │ - Matchmaking│         │ terminal view│
│      │       │   WS    │ - Prompt mgmt│   WS    │              │
│ Host Agent   │────────>│ - Byte relay │<────────│ Next.js App  │
│ (node-pty)   │         │ - Chat/Timer │         │              │
└──────────────┘         │              │         └──────────────┘
                         │ PostgreSQL   │
                         │ (users,      │
                         │  sessions,   │
                         │  reports)    │
                         └──────────────┘
```

**Tech stack:**
- **Server:** Node.js + Express + `ws` library. TypeScript.
- **Frontend:** Next.js. xterm.js for terminal rendering. Tailwind for styling.
- **Database:** PostgreSQL (Supabase or Neon for managed hosting).
- **Host agent:** Node.js CLI distributed via npm. Uses `node-pty` to spawn Claude Code.
- **Hosting:** Single VPS (Fly.io or Railway). WebSocket-capable.
- **Auth:** GitHub OAuth via NextAuth.

**V1 simplification decisions:**
- Single server, no microservices.
- In-memory matchmaking queue (no Redis needed at 50 users).
- PostgreSQL for users, sessions, and reports only.
- No horizontal scaling, no CDN, no container orchestration.

**Designed for V1.5 swap:** The relay server interface is clean — "host agent sends terminal bytes" can later become "cloud container sends terminal bytes" with no frontend or relay changes.

---

# Business Model

## V1 Cost Model

- Primary costs: VPS hosting, WebSocket relay, managed PostgreSQL
- Claude Code API costs are borne by the host user (they use their own API key/subscription)
- Estimated server cost at 1,000 DAU: ~$50-100/month (single VPS + managed DB)

## Monetization (future, not V1)

- Free tier with rate limits (current: 5 sessions/day)
- Premium: unlimited sessions, preference-based matching, cloud-hosted environments
- Enterprise/education: private "roulette pools" for teams, bootcamps, university CS programs

V1 is not intended to generate revenue. Success criteria are engagement and retention.

---

# Launch and Growth Strategy

## Cold Start Mitigation

The product is worthless without concurrent users. This is the existential risk and must be addressed structurally, not just with marketing.

1. **Scheduled roulette hours (not always-on).** V1 runs ClaudeRoulette at fixed times: Saturdays at 2pm EST and 2pm CET. Concentrate users into windows where matches are guaranteed. Market it as an event ("Saturday Jam Session"), not a 24/7 app. Expand windows as volume grows.

2. **Direct invite links.** Let users share a link with a friend for a direct match. This gives the product utility even with zero strangers online, and every direct-invite session is a potential conversion to roulette mode.

3. **Influencer seeding.** Recruit 10-15 developer content creators (YouTube, Twitch, Twitter/X) to try it live on stream. Solves cold start AND generates content.

4. **Community partnerships.** Partner with 2-3 coding Discord servers and run organized "ClaudeRoulette nights." Get 50 people committed to showing up at the same time.

5. **Post-session sharing.** After a session, prompt both users to share what they built with a one-click tweet/post + screenshot. Make virality effortless.

## Launch Sequence

| Phase | Timeline | Goal |
|-------|----------|------|
| Internal dogfood | Week 0 | 10 internal sessions to validate host agent + terminal sharing |
| Closed beta | Week 1-2 | 50 invited developers, 200+ completed sessions |
| Decision gate | Week 3 | Review data vs. success criteria. Go/no-go for public launch. |
| Open beta | Week 3-4 | HN/Twitter launch, target 500 signups |
| Iterate on retention | Week 5+ | Expand roulette hours as volume justifies |

---

# Development and Launch Planning

## Key Milestones

| Milestone | Target | Owner | Status | Notes |
|-----------|--------|-------|--------|-------|
| Technical spike: host agent + terminal streaming | Week 1-2 | Eng | Not started | **Go/no-go for entire project.** Must validate: can we reliably stream a Claude Code PTY session through a relay to a browser with <100ms latency? |
| Security review of host agent | Week 2-3 | Eng | Not started | **Hard launch blocker.** Formal threat model + external review. |
| GitHub OAuth + user accounts | Week 3 | Eng | Not started | |
| WebSocket relay server (core) | Week 3-4 | Eng | Not started | Connection mgmt, session rooms, byte relay, chat |
| Driver/Navigator prompt system | Week 4-5 | Eng | Not started | Input field, role swap, keyword warnings |
| Matchmaking queue + host selection | Week 5 | Eng | Not started | FIFO + latency-based host selection |
| Web app UI (all screens) | Week 4-6 | Eng | Not started | Landing, queue, session, end screen |
| Project suggestion deck | Week 5-6 | Eng/Design | Not started | Curate 20-30 fun project ideas |
| Timer, re-match, session lifecycle | Week 6 | Eng | Not started | |
| Shared artifact (gist creation) | Week 6 | Eng | Not started | |
| Direct invite links | Week 6 | Eng | Not started | |
| Reporting + moderation basics | Week 6-7 | Eng | Not started | |
| Internal dogfood (10 sessions) | Week 7 | All | Not started | |
| Closed beta (50 users) | Week 8-9 | PM | Not started | |
| Decision gate: review beta data | Week 10 | PM/Eng | Not started | Go/no-go for public launch |
| Public launch | Week 10-11 | PM | Not started | |

**Critical path:** Host agent spike (weeks 1-2) → Security review (weeks 2-3) → Everything else builds on this foundation.

**Estimated effort:** 10-12 weeks for one senior full-stack engineer, or 6-8 weeks for two engineers working in parallel (host agent + backend || frontend).

## Operational Checklist

| Item | Owner | Status | Notes |
|------|-------|--------|-------|
| Security review of host agent | Eng | Not started | **Launch blocker** |
| Privacy policy (what data we collect/store) | Legal/PM | Not started | |
| Abuse/moderation runbook | PM | Not started | |
| Infrastructure cost estimate | Eng | Not started | |
| Project suggestion deck curation | PM/Design | Not started | 20-30 fun, achievable-in-30-min ideas |
| Host agent open-source repo setup | Eng | Not started | Public repo, signed releases |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Security incident** (terminal sharing exposes sensitive data) | Critical | Isolated working directory, no auto-approve, keyword warnings, security review as launch blocker, open-source agent |
| **Cold start** (no one online to match with) | High | Scheduled roulette hours, direct invite links, influencer seeding, community partnerships |
| **Host agent setup friction** (contradicts "zero-friction start") | High | Single `npx` command, pre-qualify hosts before queue entry, allow non-host-only mode |
| **Awkward matches** (skill mismatch, silent partner) | Medium | No-fault re-match in first 3 min, project suggestion deck, chat sidebar for coordination |
| **Host reliability** (bad connection, weak machine) | Medium | Latency-based host selection, 60s reconnection window, opt-out of hosting |
| **Abuse** (harassment, malicious prompts) | Medium | Reporting, rate limiting, moderation runbook, keyword warnings |
| **Host bears API cost** | Low | Host uses own Claude Code subscription. Flagged for fairness review — consider providing session API keys in V2 |

## Competitive Positioning

- **vs. Replit multiplayer:** Replit is a full IDE with persistent projects. ClaudeRoulette is spontaneous, timeboxed, stranger-matching — a fundamentally different use case (jam session vs. workspace).
- **vs. Discord coding communities:** Discord facilitates finding people but doesn't provide the shared coding environment. ClaudeRoulette is the full experience: match + environment + AI in one click.
- **vs. VS Code Live Share:** Live Share is a tool for existing collaborators. ClaudeRoulette is the matchmaking + the experience.
- **Moat:** The roulette mechanic + shared Claude Code interaction is genuinely novel. No existing product combines random matching with AI-assisted collaborative coding.

## Open Questions

1. **Should ClaudeRoulette provide an API key for sessions** so the host doesn't bear the cost? Significant cost implications but improves fairness.
2. **What is the ideal session length?** 30 minutes is a hypothesis. Should be validated with beta data — consider a 15-minute check-in model where pairs extend if they want.
3. **Can a user opt out of being host but still participate?** Current answer: yes (non-host-only mode). Need to monitor if this creates a host shortage.
4. **What happens to files created during a session?** Current answer: they stay in the host's designated directory + captured in a shared gist. Is this sufficient for the non-host?

## FAQ

- **Q: Why not just use VS Code Live Share?** A: ClaudeRoulette is about the spontaneous matchmaking + AI-assisted building experience, not just screen sharing. The roulette mechanic and collaborative Claude interaction are the product.
- **Q: What if nobody is online?** A: V1 runs at scheduled times (Saturday jam sessions) to concentrate users. Direct invite links let you pair with a friend anytime. Queue shows estimated wait time.
- **Q: Can I pick my partner?** A: Not via the queue — randomness is core. But direct invite links let you pair with a specific person.
- **Q: Is my machine safe as a host?** A: Claude Code runs in an isolated directory with auto-approve disabled. Every command execution requires your explicit approval. The host agent is open-source and auditable. See Security Model for full details.
- **Q: What do I need to be a host?** A: Claude Code installed, stable internet, and `npx clauderoulette-host` running. macOS or Linux (Windows via WSL).
