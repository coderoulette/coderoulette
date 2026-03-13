import { Command } from "commander";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnClaudeCode } from "./pty.js";
import { connectToRelay } from "./ws-client.js";
import type { AgentCommand } from "@clauderoulette/shared";

const program = new Command();

program
  .name("clauderoulette-host")
  .description("CodeRoulette host agent — share your Claude Code session")
  .version("0.1.0")
  .option("-s, --server <url>", "Relay server WebSocket URL", "ws://localhost:3001")
  .option("-w, --workdir <path>", "Working directory for Claude Code")
  .option("-t, --token <token>", "Auth token from the CodeRoulette web app")
  .action(async (opts) => {
    const workDir = opts.workdir || mkdtempSync(join(tmpdir(), "clauderoulette-"));
    const token = opts.token || process.env.CODEROULETTE_TOKEN || "";
    if (!token) {
      console.error("[agent] Error: No --token provided.");
      console.error("[agent] Get your token from the CodeRoulette web app at /host\n");
      process.exit(1);
    }

    console.log(`
┌──────────────────────────────────────┐
│        CodeRoulette Host Agent       │
├──────────────────────────────────────┤
│  Server: ${opts.server.padEnd(28)}│
│  Work dir: ${workDir.slice(-26).padEnd(26)}│
└──────────────────────────────────────┘
`);
    console.log("[agent] Connecting to relay server...");
    console.log("[agent] Will spawn Claude Code when a session starts.\n");

    const MAX_PROMPT_LENGTH = 10_000; // 10KB max prompt
    const MAX_INPUT_LENGTH = 1_000;  // 1KB max terminal input
    const RATE_LIMIT_MS = 50;        // Min 50ms between commands
    let lastCommandAt = 0;

    let ptySession: ReturnType<typeof spawnClaudeCode> | null = null;
    let sessionPending = false;

    function spawnWithDimensions(cols: number, rows: number) {
      if (ptySession) return;
      console.log(`[agent] Spawning Claude Code (${cols}x${rows}) in ${workDir}...`);
      ptySession = spawnClaudeCode(workDir, cols, rows);

      ptySession.onData((data) => {
        relay.send(data);
      });

      // Auto-accept trust prompt for temp working directory
      setTimeout(() => {
        console.log("[agent] Auto-accepting trust prompt");
        ptySession?.write("\r");
      }, 2000);

      ptySession.onExit((code) => {
        console.log(`[agent] Claude Code exited (${code})`);
        ptySession = null;
        console.log("[agent] Ready for next session.");
      });
    }

    const relay = connectToRelay({
      serverUrl: opts.server,
      token,
      onCommand(command: AgentCommand) {
        // Rate limiting
        const now = Date.now();
        if (now - lastCommandAt < RATE_LIMIT_MS && command.type !== "start_session" && command.type !== "end_session") {
          return;
        }
        lastCommandAt = now;

        switch (command.type) {
          case "start_session":
            console.log(`[agent] Session assigned: ${command.sessionId}`);
            sessionPending = true;
            // Don't spawn yet — wait for resize with actual terminal dimensions
            // Fall back after 3s in case resize never arrives
            setTimeout(() => {
              if (sessionPending && !ptySession) {
                console.log("[agent] No resize received, spawning with defaults");
                spawnWithDimensions(120, 40);
                sessionPending = false;
              }
            }, 3000);
            break;

          case "send_prompt":
            if (command.text.length > MAX_PROMPT_LENGTH) {
              console.log(`[agent] Rejected prompt: too long (${command.text.length} chars)`);
              break;
            }
            console.log(`[agent] Prompt: ${command.text.slice(0, 60)}${command.text.length > 60 ? "..." : ""}`);
            if (ptySession) {
              ptySession.write(command.text + "\r");
            }
            break;

          case "terminal_input":
            if (!command.data || command.data.length > MAX_INPUT_LENGTH) {
              break;
            }
            if (ptySession) {
              ptySession.write(command.data);
            }
            break;

          case "resize":
            if (command.cols && command.rows && command.cols <= 500 && command.rows <= 200 && command.cols > 0 && command.rows > 0) {
              if (sessionPending && !ptySession) {
                // First resize — spawn with correct dimensions
                sessionPending = false;
                spawnWithDimensions(command.cols, command.rows);
              } else if (ptySession) {
                ptySession.resize(command.cols, command.rows);
              }
            }
            break;

          case "end_session":
            console.log("[agent] Session ended");
            sessionPending = false;
            if (ptySession) {
              ptySession.kill();
              ptySession = null;
            }
            break;
        }
      },
      onOpen() {
        console.log("[agent] Connected — waiting for session...");
      },
      onClose() {
        console.log("[agent] Disconnected");
      },
    });

    const cleanup = () => {
      console.log("\n[agent] Shutting down...");
      if (ptySession) ptySession.kill();
      relay.close();
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });

program.parse();
