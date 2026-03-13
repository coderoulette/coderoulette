# CodeRoulette — Pair program with a stranger

<p align="center">
  <strong>Two humans + one AI agent. 30 minutes. Build something fun.</strong>
</p>

<p align="center">
  <a href="https://github.com/coderoulette/coderoulette/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/coderoulette/coderoulette/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/coderoulette/coderoulette/releases"><img src="https://img.shields.io/github/v/release/coderoulette/coderoulette?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**CodeRoulette** pairs you with a random developer for a timeboxed, AI-assisted pair programming session powered by [Claude Code](https://docs.anthropic.com/en/docs/claude-code). One person hosts, the other joins through the browser — both see the same terminal, collaborate on prompts, and build something together in 30 minutes.

Think Omegle meets hackathons, but for coding with AI.

[Website](https://coderoulette.ee) · [Vision](VISION.md) · [Host Agent](https://github.com/coderoulette/host) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

---

## How it works

1. **Match** — Sign in with GitHub, hit "Find a partner," get randomly paired
2. **Plan** — Vote on a fun project idea (or bring your own)
3. **Build** — Take turns driving Claude Code in a shared terminal session

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

The host runs a [lightweight CLI agent](https://github.com/coderoulette/host) that spawns Claude Code locally. Terminal output streams through a WebSocket relay server to both browsers. The navigator joins with zero setup — just a browser.

## Features

- **Random matchmaking** — FIFO queue with latency-based host selection
- **Driver/Navigator model** — take turns driving Claude Code, request role swaps anytime
- **Shared terminal** — real-time xterm.js rendering of the host's Claude Code session
- **Chat sidebar** — coordinate what to build, suggest prompts, share ideas
- **Project suggestions** — vote on fun 30-minute project ideas to beat the blank canvas
- **30-minute timer** — 15-min check-in, 5-min warning, optional +15min extension
- **No-fault re-match** — not vibing? Try a different match in the first 3 minutes
- **Direct invite links** — pair with a friend instead of a stranger
- **Prompt safety checks** — warnings when prompts reference sensitive paths

## Quick start

### Prerequisites

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed (for hosting)
- GitHub account (for authentication)

### 1. Clone and install

```bash
git clone https://github.com/coderoulette/coderoulette.git
cd coderoulette
npm install
```

### 2. Set up environment

```bash
cp .env.example apps/web/.env.local
cp .env.example apps/server/.env
```

Edit both files with your GitHub OAuth credentials (create an app at [github.com/settings/developers](https://github.com/settings/developers)) and generate secrets:

```bash
# Generate random secrets
openssl rand -base64 32  # Use for NEXTAUTH_SECRET and JWT_SECRET
```

### 3. Run locally

```bash
npm run dev       # Starts server (port 3001) + web app (port 3000)
```

To also run the host agent for a full demo:

```bash
npm run demo      # Starts server + web + host agent
```

Open [http://localhost:3000](http://localhost:3000) in two browser windows to test.

## Project structure

This is the main monorepo containing the server, web app, and shared types. The [host agent](https://github.com/coderoulette/host) lives in a separate repo.

```
coderoulette/
├── apps/
│   ├── server/          # Express + WebSocket relay server
│   │   └── src/
│   │       ├── ws/          # WebSocket handlers, rooms, agent pool
│   │       ├── matchmaking/ # Queue and matching logic
│   │       ├── session/     # Session lifecycle and timers
│   │       └── chat/        # Chat message broadcasting
│   └── web/             # Next.js 15 frontend
│       ├── app/             # Pages (home, queue, session, invite, host)
│       ├── components/      # Terminal, ChatSidebar, PromptInput, etc.
│       ├── hooks/           # useWebSocket, useTimer
│       └── lib/             # Auth config, WS URL builder
├── packages/
│   └── shared/          # Types, constants, project ideas, safety checks
└── .env.example         # Environment variables template
```

## Host agent

The host agent is a separate CLI tool that spawns Claude Code locally and relays terminal I/O. It lives in its own repo: [coderoulette/host](https://github.com/coderoulette/host).

```bash
npx coderoulette-host --server wss://coderoulette.ee/ws --token <your-token>
```

Get your token from [coderoulette.ee/host](https://coderoulette.ee/host) after signing in.

## Tech stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 15, React 19, xterm.js, Tailwind CSS |
| Backend | Express, ws (WebSocket), TypeScript |
| Auth | NextAuth (GitHub OAuth) + JWT for WebSocket |
| Host Agent | node-pty, Commander.js, WebSocket client |
| Terminal | xterm.js (browser), node-pty (host) |
| Monorepo | npm workspaces |

## Environment variables

See [`.env.example`](.env.example) for all required variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app client secret |
| `NEXTAUTH_URL` | Yes | Your app URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Yes | Random secret for NextAuth session encryption |
| `JWT_SECRET` | Yes | Random secret for WebSocket auth tokens |
| `PORT` | No | Server port (default: 3001) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_WS_URL` | No | WebSocket URL (default: `ws://localhost:3001`) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. PRs welcome!

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

[MIT](LICENSE)
