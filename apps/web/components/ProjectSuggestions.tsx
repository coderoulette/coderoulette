"use client";

import type { ProjectIdea } from "@clauderoulette/shared";

interface ProjectSuggestionsProps {
  projects: ProjectIdea[];
  votes: Record<string, { up: number; down: number }>;
  onVote: (projectId: string, vote: "up" | "down") => void;
  onDismiss: () => void;
}

const EMOJI_MAP: Record<string, string> = {
  "1": "~",
  "2": "*",
  "3": "#",
};

export function ProjectSuggestions({
  projects,
  votes,
  onVote,
  onDismiss,
}: ProjectSuggestionsProps) {
  return (
    <div className="absolute inset-0 bg-surface/95 backdrop-blur-md z-10 flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full space-y-5 animate-slide-up">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-violet/10 text-accent-violet text-[11px] font-semibold rounded-full mb-2">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            PICK A PROJECT
          </div>
          <h2 className="text-xl font-bold text-zinc-100">What should we build?</h2>
          <p className="text-[13px] text-zinc-500">
            Vote together, or skip and freestyle
          </p>
        </div>

        {/* Project cards */}
        <div className="space-y-2.5">
          {projects.map((project, i) => {
            const projectVotes = votes[project.id] || { up: 0, down: 0 };
            const isMutualLike = projectVotes.up >= 2;

            return (
              <div
                key={project.id}
                className={`group p-4 rounded-xl border transition-all cursor-default ${
                  isMutualLike
                    ? "bg-accent-emerald/[0.06] border-accent-emerald/20 glow-brand"
                    : "bg-surface-raised border-white/[0.04] hover:border-white/[0.08]"
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-overlay flex items-center justify-center shrink-0 text-zinc-600 font-mono text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold text-zinc-200">
                      {project.title}
                      {isMutualLike && (
                        <span className="ml-2 text-[11px] font-medium text-accent-emerald">
                          Match!
                        </span>
                      )}
                    </h3>
                    <p className="text-[12px] text-zinc-500 mt-0.5 leading-relaxed">
                      {project.description}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => onVote(project.id, "up")}
                      className="w-8 h-8 rounded-lg bg-surface-overlay hover:bg-accent-emerald/10 text-zinc-500 hover:text-accent-emerald transition-all flex items-center justify-center text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V3a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onVote(project.id, "down")}
                      className="w-8 h-8 rounded-lg bg-surface-overlay hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all flex items-center justify-center text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Skip button */}
        <button
          onClick={onDismiss}
          className="w-full py-2.5 text-[13px] text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          Skip — we have our own idea
        </button>
      </div>
    </div>
  );
}
