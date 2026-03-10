import * as pty from "node-pty";
import { OutputBuffer } from "./buffer.js";

export interface PtySession {
  write: (data: string) => void;
  onData: (callback: (data: Buffer) => void) => void;
  onExit: (callback: (code: number) => void) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  buffer: OutputBuffer;
}

export function spawnClaudeCode(workDir: string): PtySession {
  const buffer = new OutputBuffer();
  const dataCallbacks: ((data: Buffer) => void)[] = [];
  const exitCallbacks: ((code: number) => void)[] = [];

  // Spawn Claude Code in the working directory without auto-approve
  const proc = pty.spawn("claude", [], {
    name: "xterm-256color",
    cols: 120,
    rows: 40,
    cwd: workDir,
    env: {
      ...process.env,
      TERM: "xterm-256color",
    },
  });

  proc.onData((data: string) => {
    const buf = Buffer.from(data, "utf-8");
    buffer.push(buf);
    for (const cb of dataCallbacks) {
      cb(buf);
    }
  });

  proc.onExit(({ exitCode }) => {
    for (const cb of exitCallbacks) {
      cb(exitCode);
    }
  });

  return {
    write(data: string) {
      proc.write(data);
    },
    onData(callback: (data: Buffer) => void) {
      dataCallbacks.push(callback);
    },
    onExit(callback: (code: number) => void) {
      exitCallbacks.push(callback);
    },
    resize(cols: number, rows: number) {
      proc.resize(cols, rows);
    },
    kill() {
      proc.kill();
    },
    buffer,
  };
}
