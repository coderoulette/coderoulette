# Contributing to CodeRoulette

Thanks for your interest in contributing!

## Quick Links

- **Main repo:** https://github.com/coderoulette/coderoulette
- **Host agent repo:** https://github.com/coderoulette/host
- **Vision:** [`VISION.md`](VISION.md)

## Maintainers

- **Ian Knives** — Creator
  - GitHub: [@ianknives](https://github.com/ianknives)

## How to Contribute

1. **Bugs & small fixes** — Open a PR
2. **New features / architecture** — Start a [GitHub Discussion](https://github.com/coderoulette/coderoulette/discussions) or open an issue first
3. **Questions** — Open an issue

## Before You PR

- Test locally with a full demo (`npm run demo`)
- Run the build: `npm run build`
- Keep PRs focused (one thing per PR)
- Describe what and why in the PR description

## Development Setup

```bash
git clone https://github.com/coderoulette/coderoulette.git
cd coderoulette
npm install

# Set up environment
cp .env.example apps/web/.env.local
cp .env.example apps/server/.env
# Edit both .env files with your config

# Dev loop (auto-reload)
npm run dev

# Full demo (server + web + host agent)
npm run demo
```

## Repo Structure

CodeRoulette is split across two repos:

| Repo | What |
|------|------|
| [coderoulette/coderoulette](https://github.com/coderoulette/coderoulette) | Server, web app, shared types (this repo) |
| [coderoulette/host](https://github.com/coderoulette/host) | CLI host agent (`coderoulette-host` npm package) |

Within this repo:

- `apps/server/` — Express + WebSocket relay server
- `apps/web/` — Next.js frontend
- `packages/shared/` — Shared types, constants, and utilities

## AI-Assisted PRs Welcome

Built with Claude, Codex, or other AI tools? Great — just note it in your PR description. We care about code quality, not how it was written.

## Report a Vulnerability

See [SECURITY.md](SECURITY.md) for how to report security issues.
