# Security Policy

If you believe you've found a security issue in CodeRoulette, please report it responsibly.

## Reporting

**Email:** [security@coderoulette.ee](mailto:security@coderoulette.ee)

Or use GitHub Security Advisories for private disclosure:

- **Server & web app** — [coderoulette/coderoulette](https://github.com/coderoulette/coderoulette/security/advisories/new)
- **Host agent** — [coderoulette/host](https://github.com/coderoulette/host/security/advisories/new)

### What to Include

1. **Description** of the vulnerability
2. **Affected component** (server, web app, host agent, shared)
3. **Steps to reproduce**
4. **Impact assessment** — what can an attacker do?
5. **Suggested fix** (if you have one)

## Security Model

CodeRoulette's security relies on several layers:

### Host Agent Security

- **Outbound-only connections** — the host agent opens a WebSocket to the relay server. No ports are exposed on the host machine.
- **Isolated working directory** — Claude Code runs in a temp directory or user-specified folder, never the home directory.
- **Claude Code permissions** — Claude Code's built-in permission system prompts the host before running commands or writing files. The host is always the final gatekeeper.
- **Open-source and auditable** — the host agent is a thin PTY wrapper with minimal scope.

### Relay Server Security

- **JWT authentication** — all WebSocket connections require a valid JWT token.
- **Input validation** — prompts (10K char limit), terminal input (1K char limit), and chat messages (2K char limit) are size-bounded.
- **Authorization checks** — only the driver can send prompts/input, only the host can approve navigator prompts.

### Web App Security

- **GitHub OAuth** — authentication via NextAuth with GitHub provider.
- **Security headers** — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection.
- **Prompt safety warnings** — references to sensitive paths (`.ssh`, `.env`, credentials) trigger warnings before sending.

## Out of Scope

- Claude Code's own security model (report to [Anthropic](https://anthropic.com))
- Vulnerabilities requiring physical access to the host machine
- Social engineering attacks
- Denial of service via normal usage patterns

## Bug Bounties

CodeRoulette is a community project. There is no bug bounty program. Please still disclose responsibly so we can fix issues quickly. The best way to help is by sending PRs.
