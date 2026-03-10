#!/usr/bin/env node

import { Command } from "commander";
import { randomUUID } from "crypto";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnClaudeCode } from "./pty.js";
import { connectToRelay } from "./ws-client.js";
import type { AgentCommand } from "@clauderoulette/shared";

const program = new Command();

program
  .name("clauderoulette-host")
  .description("ClaudeRoulette host agent — share your Claude Code session")
  .version("0.1.0")
  .option("-s, --server <url>", "Relay server WebSocket URL", "ws://localhost:3001")
  .option("-w, --workdir <path>", "Working directory for Claude Code")
  .action(async (opts) => {
    const workDir = opts.workdir || mkdtempSync(join(tmpdir(), "clauderoulette-"));
    const agentId = `agent-${randomUUID().slice(0, 8)}`;

    console.log(`
┌──────────────────────────────────────┐
│       ClaudeRoulette Host Agent      │
├──────────────────────────────────────┤
│  Server: ${opts.server.padEnd(28)}│
│  Work dir: ${workDir.slice(-26).padEnd(26)}│
└──────────────────────────────────────┘
`);
    console.log("[agent] Connecting to relay server...");
    console.log("[agent] Will spawn Claude Code when a session starts.\n");

    let ptySession: ReturnType<typeof spawnClaudeCode> | null = null;

    const relay = connectToRelay({
      serverUrl: opts.server,
      userId: agentId,
      username: "host-agent",
      avatarUrl: "",
      onCommand(command: AgentCommand) {
        switch (command.type) {
          case "start_session":
            console.log(`[agent] Session assigned: ${command.sessionId}`);
            console.log(`[agent] Spawning Claude Code in ${workDir}...`);
            if (!ptySession) {
              ptySession = spawnClaudeCode(workDir);

              ptySession.onData((data) => {
                relay.send(data);
              });

              ptySession.onExit((code) => {
                console.log(`[agent] Claude Code exited (${code})`);
                ptySession = null;
                // Don't exit — stay in pool for next session
                console.log("[agent] Ready for next session.");
              });
            }
            break;

          case "send_prompt":
            console.log(`[agent] Prompt: ${command.text.slice(0, 60)}${command.text.length > 60 ? "..." : ""}`);
            if (ptySession) {
              ptySession.write(command.text + "\n");
            }
            break;

          case "end_session":
            console.log("[agent] Session ended");
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
