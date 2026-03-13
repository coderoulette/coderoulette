"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface TerminalHandle {
  write: (data: string) => void;
  writeRaw: (data: string) => void;
  clear: () => void;
  getDimensions: () => { cols: number; rows: number } | null;
}

interface TerminalProps {
  className?: string;
  welcomeMessage?: string;
  onResize?: (cols: number, rows: number) => void;
  onInput?: (data: string) => void;
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  function Terminal({ className, welcomeMessage, onResize, onInput }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
    const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
    const pendingWritesRef = useRef<string[]>([]);
    const onResizeRef = useRef(onResize);
    const onInputRef = useRef(onInput);
    onResizeRef.current = onResize;
    onInputRef.current = onInput;

    useImperativeHandle(ref, () => ({
      write(data: string) {
        if (termRef.current) {
          const raw = Uint8Array.from(atob(data), c => c.charCodeAt(0));
          termRef.current.write(raw);
        } else {
          pendingWritesRef.current.push(data);
        }
      },
      writeRaw(data: string) {
        if (termRef.current) {
          termRef.current.write(data);
        }
      },
      clear() {
        termRef.current?.clear();
      },
      getDimensions() {
        if (!termRef.current) return null;
        return { cols: termRef.current.cols, rows: termRef.current.rows };
      },
    }));

    useEffect(() => {
      let disposed = false;
      let term: import("@xterm/xterm").Terminal;
      let fitAddon: import("@xterm/addon-fit").FitAddon;

      async function init() {
        const { Terminal: XTerm } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        // @ts-expect-error CSS import handled by bundler
        await import("@xterm/xterm/css/xterm.css");

        // Bail out if component was unmounted during async imports (React Strict Mode)
        if (disposed) return;

        term = new XTerm({
          disableStdin: false,
          cursorBlink: false,
          cursorInactiveStyle: "none",
          fontFamily: "JetBrains Mono, Fira Code, monospace",
          fontSize: 13,
          lineHeight: 1.0,
          letterSpacing: 0,
          convertEol: false,
          allowProposedApi: true,
          theme: {
            background: "#09090b",
            foreground: "#d4d4d8",
            cursor: "transparent",
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
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        if (containerRef.current) {
          term.open(containerRef.current);
          fitAddon.fit();
          // Re-fit after layout settles
          requestAnimationFrame(() => {
            fitAddon.fit();
          });
        }

        termRef.current = term;
        fitAddonRef.current = fitAddon;

        // Report initial dimensions after fit
        onResizeRef.current?.(term.cols, term.rows);

        // Report dimension changes
        term.onResize(({ cols, rows }) => {
          onResizeRef.current?.(cols, rows);
        });

        // Forward keyboard input to PTY
        term.onData((data) => {
          onInputRef.current?.(data);
        });

        // Flush any pending writes that arrived before xterm loaded
        if (pendingWritesRef.current.length > 0) {
          for (const data of pendingWritesRef.current) {
            const raw = Uint8Array.from(atob(data), c => c.charCodeAt(0));
            term.write(raw);
          }
          pendingWritesRef.current = [];
        } else {
          if (welcomeMessage) {
            term.writeln(`\x1b[90m  ${welcomeMessage}\x1b[0m`);
          } else {
            term.writeln("\x1b[90m  Connecting to Claude Code...\x1b[0m");
          }
          term.writeln("");
        }
      }

      init();

      const handleResize = () => fitAddonRef.current?.fit();
      window.addEventListener("resize", handleResize);

      const ro = new ResizeObserver(handleResize);
      if (containerRef.current) ro.observe(containerRef.current);

      // Re-fit on browser zoom changes via visualViewport
      const handleZoom = () => {
        setTimeout(() => fitAddonRef.current?.fit(), 50);
      };
      window.visualViewport?.addEventListener("resize", handleZoom);

      return () => {
        disposed = true;
        termRef.current = null;
        fitAddonRef.current = null;
        window.removeEventListener("resize", handleResize);
        window.visualViewport?.removeEventListener("resize", handleZoom);
        ro.disconnect();
        term?.dispose();
      };
    }, []);

    return (
      <div className={`terminal-container flex flex-col min-h-0 overflow-hidden ${className || ""}`}>
        {/* Top bar with fake traffic lights */}
        <div className="h-10 shrink-0 bg-surface-raised/80 backdrop-blur-sm border-b border-white/[0.04] flex items-center px-4 rounded-t-xl">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          </div>
          <span className="ml-3 text-[11px] text-zinc-600 font-mono">claude-code</span>
        </div>
        <div ref={containerRef} className="flex-1 min-h-0 rounded-b-xl overflow-hidden" />
      </div>
    );
  }
);
