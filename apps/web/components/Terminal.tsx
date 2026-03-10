"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface TerminalHandle {
  write: (data: string) => void;
  writeRaw: (data: string) => void;
  clear: () => void;
}

interface TerminalProps {
  className?: string;
  welcomeMessage?: string;
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  function Terminal({ className, welcomeMessage }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
    const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);

    useImperativeHandle(ref, () => ({
      write(data: string) {
        if (termRef.current) {
          const bytes = atob(data);
          termRef.current.write(bytes);
          fitAddonRef.current?.fit();
        }
      },
      writeRaw(data: string) {
        termRef.current?.write(data);
        fitAddonRef.current?.fit();
      },
      clear() {
        termRef.current?.clear();
      },
    }));

    useEffect(() => {
      let term: import("@xterm/xterm").Terminal;
      let fitAddon: import("@xterm/addon-fit").FitAddon;

      async function init() {
        const { Terminal: XTerm } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        // @ts-expect-error CSS import handled by bundler
        await import("@xterm/xterm/css/xterm.css");

        term = new XTerm({
          disableStdin: true,
          cursorBlink: false,
          fontFamily: "JetBrains Mono, Fira Code, monospace",
          fontSize: 13,
          lineHeight: 1.5,
          letterSpacing: 0,
          theme: {
            background: "#09090b",
            foreground: "#d4d4d8",
            cursor: "#f45d2e",
            selectionBackground: "#f45d2e33",
            black: "#18181b",
            brightBlack: "#71717a",
            red: "#ef4444",
            brightRed: "#f87171",
            green: "#34d399",
            brightGreen: "#6ee7b7",
            yellow: "#fbbf24",
            brightYellow: "#fde68a",
            blue: "#38bdf8",
            brightBlue: "#7dd3fc",
            magenta: "#a78bfa",
            brightMagenta: "#c4b5fd",
            cyan: "#22d3ee",
            brightCyan: "#67e8f9",
            white: "#d4d4d8",
            brightWhite: "#fafafa",
          },
          scrollback: 5000,
          convertEol: true,
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        if (containerRef.current) {
          term.open(containerRef.current);
          fitAddon.fit();
        }

        termRef.current = term;
        fitAddonRef.current = fitAddon;

        if (welcomeMessage) {
          term.writeln(`\x1b[90m  ${welcomeMessage}\x1b[0m`);
        } else {
          term.writeln("\x1b[90m  Connecting to Claude Code...\x1b[0m");
        }
        term.writeln("");
      }

      init();

      const handleResize = () => fitAddonRef.current?.fit();
      window.addEventListener("resize", handleResize);

      const ro = new ResizeObserver(handleResize);
      if (containerRef.current) ro.observe(containerRef.current);

      return () => {
        window.removeEventListener("resize", handleResize);
        ro.disconnect();
        term?.dispose();
      };
    }, []);

    return (
      <div className={`terminal-container relative ${className || ""}`}>
        {/* Top bar with fake traffic lights */}
        <div className="absolute top-0 left-0 right-0 h-10 bg-surface-raised/80 backdrop-blur-sm border-b border-white/[0.04] flex items-center px-4 z-10 rounded-t-xl">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          </div>
          <span className="ml-3 text-[11px] text-zinc-600 font-mono">claude-code</span>
        </div>
        <div ref={containerRef} className="pt-10 h-full rounded-xl overflow-hidden" />
      </div>
    );
  }
);
