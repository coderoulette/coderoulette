#!/bin/bash
# claude-global-init.sh — Sets up ~/.claude/ with reusable configs for all projects
# Run from anywhere: bash claude-global-init.sh
# Safe to re-run — overwrites configs but skips nothing destructive.
set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
echo "Setting up global Claude Code configs in: $CLAUDE_DIR"

# ============================================
# Directory structure
# ============================================
mkdir -p "$CLAUDE_DIR/hooks"
mkdir -p "$CLAUDE_DIR/agents"
mkdir -p "$CLAUDE_DIR/docs"
mkdir -p "$CLAUDE_DIR/skills/post-compact"
mkdir -p "$CLAUDE_DIR/skills/interface-design/references"
mkdir -p "$CLAUDE_DIR/skills/ship"

# ============================================
# ~/.claude/settings.json (global hooks)
# ============================================
# Merges with any existing settings. If settings.json exists, we back it up.
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    # Check if it already has our hooks
    if grep -q "pre-compact.sh" "$SETTINGS_FILE" 2>/dev/null; then
        echo "settings.json already has compaction hooks, skipping"
    else
        cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak"
        echo "Backed up existing settings.json to settings.json.bak"
        # Write fresh — user can merge manually from backup if needed
        WRITE_SETTINGS=true
    fi
else
    WRITE_SETTINGS=true
fi

if [ "${WRITE_SETTINGS:-false}" = true ] || [ ! -f "$SETTINGS_FILE" ]; then
cat > "$SETTINGS_FILE" << 'SETTINGS_EOF'
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$HOME\"/.claude/hooks/pre-compact.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"$HOME\"/.claude/hooks/post-compact-inject.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$HOME\"/.claude/hooks/pre-tool-check.sh"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$HOME\"/.claude/hooks/pre-bash-check.sh"
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF
echo "Created settings.json"
fi

# ============================================
# Hooks (now use $HOME/.claude/ paths internally,
# but session/project data still goes to $CWD/.claude/sessions/)
# ============================================

# --- pre-compact.sh ---
cat > "$CLAUDE_DIR/hooks/pre-compact.sh" << 'HOOK_EOF'
#!/bin/bash
# PreCompact hook: converts JSONL transcript to compact Markdown before compaction.
# Stdin: JSON with session_id, transcript_path, cwd
# Creates: .claude/sessions/{session_id}/session-transcript.md + compacted flag

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')
CWD=$(echo "$INPUT" | jq -r '.cwd')

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
    echo "Error: no session_id in hook input" >&2
    exit 1
fi

if [ -z "$TRANSCRIPT_PATH" ] || [ "$TRANSCRIPT_PATH" = "null" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    echo "Error: transcript_path invalid or missing: $TRANSCRIPT_PATH" >&2
    exit 1
fi

SESSION_DIR="$CWD/.claude/sessions/$SESSION_ID"
mkdir -p "$SESSION_DIR"

# Run the converter (lives next to this hook)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python3 "$SCRIPT_DIR/convert-session.py" "$TRANSCRIPT_PATH" "$SESSION_DIR/session-transcript.md"

# Create compacted flag
touch "$SESSION_DIR/compacted"

echo "PreCompact: session $SESSION_ID transcript saved to $SESSION_DIR" >&2
HOOK_EOF

# --- post-compact-inject.sh ---
cat > "$CLAUDE_DIR/hooks/post-compact-inject.sh" << 'HOOK_EOF'
#!/bin/bash
# SessionStart(compact) hook: injects recovery instructions after compaction.

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
CWD=$(echo "$INPUT" | jq -r '.cwd')

SESSION_DIR="$CWD/.claude/sessions/$SESSION_ID"

if [ ! -f "$SESSION_DIR/compacted" ]; then
    exit 0
fi

if [ -f "$SESSION_DIR/session-complete" ]; then
    exit 0
fi

PROJECT_KEY=$(echo "$CWD" | sed 's|^/||; s|/|-|g')
JSONL_PATH="$HOME/.claude/projects/-${PROJECT_KEY}/${SESSION_ID}.jsonl"

cat << EOF
## ⚠️ COMPACTION RECOVERY REQUIRED — DO THIS FIRST ⚠️

**STOP. Do NOT continue previous work.** Write/Edit/NotebookEdit tools are **blocked** until you complete the recovery steps below. Any attempt to write files will be denied until you finish recovery. Follow these instructions NOW:

### Concrete Paths (use these exact absolute paths — do NOT guess or modify)

| Item | Path |
|---|---|
| Session ID | \`${SESSION_ID}\` |
| Session directory | \`${SESSION_DIR}\` |
| Session transcript | \`${SESSION_DIR}/session-transcript.md\` |
| Resume prompt (write here) | \`${SESSION_DIR}/resume-prompt.md\` |
| Session-complete flag | \`${SESSION_DIR}/session-complete\` |
| Original JSONL transcript | \`${JSONL_PATH}\` |
| Project directory | \`${CWD}\` |

---

EOF

# Look for skill file: first in project, then in global
SKILL_FILE="$CWD/.claude/skills/post-compact/SKILL.md"
if [ ! -f "$SKILL_FILE" ]; then
    SKILL_FILE="$HOME/.claude/skills/post-compact/SKILL.md"
fi

if [ -f "$SKILL_FILE" ]; then
    cat "$SKILL_FILE"
else
    cat << 'FALLBACK'
# Post-Compaction Recovery (fallback)

1. Read the session transcript from the **Session transcript** path above
2. Write a resume-prompt.md at the **Resume prompt** path above
3. Create the session-complete flag
4. Tell the user recovery is complete
FALLBACK
fi
HOOK_EOF

# --- pre-tool-check.sh ---
cat > "$CLAUDE_DIR/hooks/pre-tool-check.sh" << 'HOOK_EOF'
#!/bin/bash
# PreToolUse hook: blocks Write/Edit/NotebookEdit during compaction recovery.

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
CWD=$(echo "$INPUT" | jq -r '.cwd')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

SESSION_DIR="$CWD/.claude/sessions/$SESSION_ID"

if [ ! -f "$SESSION_DIR/compacted" ]; then
    exit 0
fi

if [ -f "$SESSION_DIR/session-complete" ]; then
    exit 0
fi

case "$TOOL_NAME" in
    Write|Edit|NotebookEdit) ;;
    *) exit 0 ;;
esac

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -n "$FILE_PATH" ]; then
    if [[ "$FILE_PATH" == *"resume-prompt.md" ]]; then exit 0; fi
    if [[ "$FILE_PATH" == *"/.claude/sessions/"* ]]; then exit 0; fi
fi

jq -n '{
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "BLOCKED: Compaction recovery is not complete. You MUST follow the COMPACTION RECOVERY REQUIRED instructions that were injected at the top of your context. Read the session transcript, run the gap analysis, spawn the 3 research agents, write resume-prompt.md, and create the session-complete flag. Do NOT attempt to continue previous work until recovery is done."
    }
}'
exit 0
HOOK_EOF

# --- pre-bash-check.sh ---
cat > "$CLAUDE_DIR/hooks/pre-bash-check.sh" << 'HOOK_EOF'
#!/bin/bash
# PreToolUse hook (matcher: Bash): blocks file-writing Bash commands during recovery.

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
CWD=$(echo "$INPUT" | jq -r '.cwd')

SESSION_DIR="$CWD/.claude/sessions/$SESSION_ID"

if [ ! -f "$SESSION_DIR/compacted" ]; then exit 0; fi
if [ -f "$SESSION_DIR/session-complete" ]; then exit 0; fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
if [ -z "$COMMAND" ]; then exit 0; fi

HAS_WRITE_PATTERN=false

if echo "$COMMAND" | grep -qE '(^|[^2=\-])>[^>]|>>|[|]\s*tee\b|\btee\s+-a\b|\btee\s+[^|]|\bcp\s|\bmv\s'; then
    HAS_WRITE_PATTERN=true
fi
if echo "$COMMAND" | grep -qE '\bcat\b.*<<.*>|\bcat\b.*>.*<<|\bcat\s*>'; then
    HAS_WRITE_PATTERN=true
fi
if echo "$COMMAND" | grep -qE '\b(echo|printf)\b.*>'; then
    HAS_WRITE_PATTERN=true
fi
if echo "$COMMAND" | grep -qE '\bdd\b.*of='; then
    HAS_WRITE_PATTERN=true
fi

if [ "$HAS_WRITE_PATTERN" = false ]; then exit 0; fi

if echo "$COMMAND" | grep -qE '\.claude/sessions/|resume-prompt\.md|session-complete'; then
    exit 0
fi

jq -n '{
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "BLOCKED: Bash file-writing command detected during compaction recovery. Complete the recovery process first."
    }
}'
exit 0
HOOK_EOF

# --- convert-session.py ---
cat > "$CLAUDE_DIR/hooks/convert-session.py" << 'PYEOF'
#!/usr/bin/env python3
"""Convert a Claude Code JSONL transcript to compact Markdown.

Usage:
    python3 convert-session.py <input.jsonl> <output.md>

Extracts user messages, assistant text, thinking blocks, tool_use names+paths.
Discards tool_result content, file-history-snapshot, and progress entries.
Target: ~98% size reduction.
"""

import json
import sys
import os
from datetime import datetime, timezone


def parse_content_blocks(content):
    parts = []
    if isinstance(content, str):
        parts.append(("text", content))
        return parts
    if not isinstance(content, list):
        return parts
    for block in content:
        if not isinstance(block, dict):
            continue
        btype = block.get("type", "")
        if btype == "text":
            text = block.get("text", "")
            if text.strip():
                parts.append(("text", text))
        elif btype == "thinking":
            text = block.get("thinking", "")
            if text.strip():
                if len(text) > 500:
                    text = text[:500] + f"\n... [truncated {len(text)} chars]"
                parts.append(("thinking", text))
        elif btype == "tool_use":
            name = block.get("name", "?")
            inp = block.get("input", {})
            summary = summarize_tool_input(name, inp)
            parts.append(("tool_use", f"{name}: {summary}"))
    return parts


def summarize_tool_input(name, inp):
    if not isinstance(inp, dict):
        return str(inp)[:100]
    if name in ("Read", "Write", "Edit"):
        path = inp.get("file_path", "?")
        if name == "Edit":
            old = inp.get("old_string", "")[:40]
            return f"{path} (edit: '{old}...')"
        return path
    if name == "Bash":
        cmd = inp.get("command", "?")
        return cmd[:120] + "..." if len(cmd) > 120 else cmd
    if name == "Glob":
        return inp.get("pattern", "?")
    if name == "Grep":
        return f"/{inp.get('pattern', '?')}/ in {inp.get('path', '.')}"
    if name == "Task":
        desc = inp.get("description", inp.get("prompt", "?"))
        return desc[:100] + "..." if len(desc) > 100 else desc
    if name == "WebFetch":
        return inp.get("url", "?")
    if name == "WebSearch":
        return inp.get("query", "?")
    if name in ("TaskCreate", "TaskUpdate", "TaskList", "TaskGet"):
        return inp.get("subject", inp.get("taskId", ""))
    if name == "NotebookEdit":
        return inp.get("notebook_path", "?")
    items = list(inp.items())[:3]
    return ", ".join(f"{k}={str(v)[:40]}" for k, v in items)


def convert_jsonl_to_md(input_path, output_path):
    records = []
    total_bytes = 0
    skipped = {"file-history-snapshot": 0, "progress": 0, "tool_result": 0}

    with open(input_path, "r") as f:
        for line in f:
            total_bytes += len(line.encode("utf-8"))
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            rtype = record.get("type", "")
            if rtype == "file-history-snapshot":
                skipped["file-history-snapshot"] += 1
                continue
            if rtype == "progress":
                skipped["progress"] += 1
                continue
            if record.get("isSidechain", False):
                continue
            records.append(record)

    def get_ts(r):
        ts = r.get("timestamp", "")
        if ts:
            try:
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass
        return datetime.min.replace(tzinfo=timezone.utc)

    records.sort(key=get_ts)

    lines = []
    session_id = None
    first_ts = last_ts = None
    turn_count = user_msgs = assistant_msgs = 0
    tool_uses = []
    files_touched = set()

    for record in records:
        rtype = record.get("type", "")
        ts = record.get("timestamp", "")
        msg = record.get("message", {})
        if not isinstance(msg, dict):
            continue
        if not session_id:
            session_id = record.get("sessionId", "unknown")
        if ts and not first_ts:
            first_ts = ts
        if ts:
            last_ts = ts

        role = msg.get("role", "")
        content = msg.get("content", "")

        if rtype == "system":
            if isinstance(content, str) and content.strip():
                text = content.strip()
                if len(text) > 300:
                    text = text[:300] + "..."
                lines.append(f"\n### SYSTEM [{ts[:19] if ts else '?'}]")
                lines.append(text)
            continue

        if role == "user":
            turn_count += 1
            user_msgs += 1
            parts = parse_content_blocks(content)
            text_parts = [p for p in parts if p[0] == "text"]
            if text_parts:
                lines.append(f"\n---\n### USER [{ts[:19] if ts else '?'}] (Turn {turn_count})")
                for _, ptext in text_parts:
                    if len(ptext) > 2000:
                        ptext = ptext[:2000] + f"\n... [truncated {len(ptext)} chars]"
                    lines.append(ptext)
            skipped["tool_result"] += len([p for p in parts if p[0] != "text"])

        elif role == "assistant":
            assistant_msgs += 1
            parts = parse_content_blocks(content)
            if not parts:
                continue
            if any(p[0] in ("text", "tool_use", "thinking") for p in parts):
                lines.append(f"\n### ASSISTANT [{ts[:19] if ts else '?'}]")
            for ptype, ptext in parts:
                if ptype == "thinking":
                    lines.append("**Thinking:**")
                    lines.append(f"> {ptext}")
                elif ptype == "text":
                    if len(ptext) > 1500:
                        ptext = ptext[:1500] + f"\n... [truncated {len(ptext)} chars]"
                    lines.append(ptext)
                elif ptype == "tool_use":
                    lines.append(f"- `{ptext}`")
                    tool_uses.append(ptext)
                    for token in ptext.split():
                        if "/" in token and not token.startswith("http"):
                            clean = token.strip("'\"(),")
                            if os.path.sep in clean or clean.startswith("/"):
                                files_touched.add(clean)

    header = [
        f"# Session Transcript: {session_id}", "",
        "## Stats",
        f"- **First message:** {first_ts or '?'}",
        f"- **Last message:** {last_ts or '?'}",
        f"- **Turns:** {turn_count}",
        f"- **User messages:** {user_msgs}",
        f"- **Assistant messages:** {assistant_msgs}",
        f"- **Tool invocations:** {len(tool_uses)}",
        f"- **Original JSONL size:** {total_bytes:,} bytes",
        f"- **Skipped records:** {json.dumps(skipped)}", "",
    ]
    if files_touched:
        header.append("## Files Touched")
        for fp in sorted(files_touched):
            header.append(f"- `{fp}`")
        header.append("")
    header.append("## Transcript\n")

    output = "\n".join(header + lines) + "\n"
    with open(output_path, "w") as f:
        f.write(output)

    output_bytes = len(output.encode("utf-8"))
    reduction = (1 - output_bytes / total_bytes) * 100 if total_bytes > 0 else 0
    print(f"Converted: {total_bytes:,} -> {output_bytes:,} bytes ({reduction:.1f}% reduction)")
    return 0


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.jsonl> <output.md>", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(sys.argv[1]):
        print(f"Error: {sys.argv[1]} not found", file=sys.stderr)
        sys.exit(1)
    sys.exit(convert_jsonl_to_md(sys.argv[1], sys.argv[2]))


if __name__ == "__main__":
    main()
PYEOF

# ============================================
# Agents (global — available in all projects)
# ============================================

cat > "$CLAUDE_DIR/agents/engineer.md" << 'AGENT_EOF'
---
name: (@_@) engineer
description: Technical feasibility assessment, architecture review, and implementation complexity analysis. Use when evaluating technical specs, reviewing PRDs for engineering feasibility, estimating implementation effort, or getting feedback on system design decisions.
tools: Read, Grep, Glob, Bash
model: inherit
color: purple
---

# (@_@) Engineer - Technical Review Specialist

You are an experienced software engineer with 10+ years at top tech companies (Google, Meta, startups). You think deeply about technical architecture, scalability, performance, and implementation details.

## Your Role

When analyzing features or specs, you provide:
- **Technical feasibility assessment** - Can this actually be built? What are the constraints?
- **Implementation complexity estimates** - How hard is this? What's the LOE?
- **Potential challenges and edge cases** - What problems will engineering hit?
- **Performance and scalability considerations** - Will this work at scale?
- **Concrete, specific recommendations** - What should we change or add?

## Communication Style

- **Direct and pragmatic** - Say what works and what doesn't
- **Focus on what's technically possible vs ideal** - Balance perfection with reality
- **Flag risks early** - Don't let technical debt accumulate
- **Suggest alternatives when something won't work** - Be solution-oriented
- **Balance perfectionism with shipping** - Good enough to ship is often the right answer

## Review Structure

1. **Technical Feasibility** (Can we build this?)
2. **Implementation Complexity** (How hard is it? Estimate effort)
3. **Key Challenges** (What will be difficult?)
4. **Performance & Scalability** (Will it scale?)
5. **Recommendations** (What should change?)
6. **Open Questions** (What needs clarification?)
AGENT_EOF

cat > "$CLAUDE_DIR/agents/executive.md" << 'AGENT_EOF'
---
name: (ಠ_ಠ) executive
description: Strategic framing, executive communication, and stakeholder alignment specialist. Use when converting technical updates to executive summaries, framing work for leadership, writing business cases, or getting advice on stakeholder communication.
tools: Read, Grep, Glob, Bash
model: inherit
color: blue
---

# (ಠ_ಠ) Executive - Strategic Communication Specialist

You are a seasoned executive (VP or C-level) with 15+ years of leadership experience at high-growth tech companies. You think strategically about business impact, stakeholder alignment, and organizational priorities.

## Your Role

- **Strategic framing and business context** - How does this connect to company goals?
- **Executive summary writing** - Concise, impact-focused communication
- **Stakeholder communication advice** - How to get buy-in and alignment
- **Resource allocation perspective** - Is this worth the investment?
- **Risk assessment from a business lens** - What could go wrong strategically?

## Communication Structure

1. **Executive Summary** (3 bullets max - what, why, impact)
2. **Business Impact** (Metrics, outcomes, value)
3. **Strategic Context** (How this connects to company goals)
4. **Risks & Mitigation** (What could go wrong, how we'll handle it)
5. **Resource Requirements** (What we need, why it's justified)
6. **Decision Needed** (What you're asking for, by when)
7. **Next Steps** (What happens after approval)
AGENT_EOF

cat > "$CLAUDE_DIR/agents/user-researcher.md" << 'AGENT_EOF'
---
name: (^◡^) user-researcher
description: User research analysis, pain point identification, and qualitative insight synthesis. Use when analyzing user interviews, synthesizing research findings, identifying user pain points, refining personas, or extracting insights from support tickets and feedback.
tools: Read, Grep, Glob, Bash
model: inherit
color: green
---

# (^◡^) User Researcher - Insight Synthesis Specialist

You are an experienced UX researcher with 8+ years conducting user interviews, surveys, and qualitative analysis. You deeply understand user psychology, behavioral patterns, and how to extract insights from messy qualitative data.

## Your Role

- **Pain point identification and prioritization** - What's actually bothering users?
- **Pattern recognition across user feedback** - What themes emerge?
- **User persona refinement** - Who are we really building for?
- **Research methodology advice** - How should we study this?
- **Insight synthesis** - What does this research really tell us?

## Research Synthesis Structure

1. **Executive Summary** (Top 3 insights in one sentence each)
2. **Key Pain Points** (Ranked by frequency + severity, with supporting quotes)
3. **User Patterns & Behaviors** (What users actually do)
4. **Personas & Segments** (Who are we building for?)
5. **Jobs-to-be-Done** (What users are trying to accomplish)
6. **Product Implications** (What this means for roadmap/priorities)
7. **Research Gaps** (What we still need to learn)
8. **Recommended Next Steps** (Follow-up research needed)
AGENT_EOF

# ============================================
# Docs (global — reference material for all projects)
# ============================================

cat > "$CLAUDE_DIR/docs/socratic-questioning.md" << 'DOC_EOF'
# Socratic Questioning Framework for PRDs

Use 3-5 questions total from these categories to sharpen feature thinking.

## 1. Problem Clarity
- "What specific user pain point does this solve?"
- "How do we know this is a real problem?"
- "Who experiences this problem most acutely?"
- "What's the cost of NOT solving this?"

## 2. Solution Validation
- "Why is this the right solution for that problem?"
- "What alternatives did you consider? Why did you reject them?"
- "What's the simplest version that solves the core problem?"
- "How will users discover this feature?"

## 3. Success Criteria
- "How will we know if this feature is successful?"
- "What would make you consider this feature a failure?"
- "What metric are we trying to move? By how much?"

## 4. Constraints & Trade-offs
- "What are the technical constraints or risks?"
- "What are we NOT going to do as part of this?"
- "If we had half the time/resources, what would we cut?"

## 5. Strategic Fit
- "Why is this the right feature to build RIGHT NOW?"
- "How does this fit into our broader product strategy?"
- "What happens if we wait 6 months to build this?"

## Red Flags
- Vague language ("users want better...")
- Solution-first thinking (can describe feature but not problem)
- Lack of evidence ("I think users would like...")
- Unclear success criteria
DOC_EOF

cat > "$CLAUDE_DIR/docs/carls-prd-template.md" << 'DOC_EOF'
# Carl's PRD Template

# Problem Alignment

## Problem & Opportunity
Describe the problem in 1-2 sentences. Why does this matter? What evidence supports it? Why now?

## High Level Approach
Rough shape of the solution. What alternatives were considered?

### Narrative
Optional: hypothetical user stories showing life today vs with the solution.

## Goals
1. High-level goals in priority order (measurable + immeasurable)
2. Include guardrail metrics

## Non-goals
1. Explicit areas we will NOT address, and why

# Solution Alignment

## Key Features
Plan of record (priority ordered). Future considerations.

### Key Flows
End-to-end experience: prose, diagrams, screenshots, or design explorations.

### Key Logic
Rules for design/development. Common scenarios and edge cases. Non-functional requirements.

# Development and Launch Planning

## Key Milestones
| Milestone | Target Date | Owner | Status |

## Operational Checklist
| Item | Owner | Status |

## Other
Appendix, Changelog, FAQ, Risks
DOC_EOF

# ============================================
# Skills (global — compaction recovery)
# ============================================

cat > "$CLAUDE_DIR/skills/post-compact/SKILL.md" << 'SKILL_EOF'
# Post-Compaction Recovery

You are running the post-compaction recovery process. A compaction event just occurred, and the full pre-compaction transcript has been saved to Markdown. Your job is to analyze it, recover lost context, and generate a handoff document.

**IMPORTANT**: All paths you need are in the **Concrete Paths** table injected above this section. Use those exact absolute paths — do NOT construct paths yourself.

## Step 1: Read the Session Transcript

Read the file at the **Session transcript** path from the Concrete Paths table (~1-2% of original size). Read the entire file.

## Step 2: Gap Analysis

Categorize your knowledge into four buckets:

### CLEAR
- What was the user's overall goal?
- What files were created/modified?
- What's the current state of the project?

### FUZZY
- Implementation details you can't fully reconstruct
- Configuration values or patterns that were referenced
- Decisions whose rationale is unclear

### GAPS
- Error messages and their resolutions
- Test results, reverted ideas, specific code written

### QUANTITATIVE UNKNOWNS
- Port numbers, version strings, file paths
- Command outputs, counts, sizes

## Step 3: Parallel Sub-Agent Research

Spawn exactly 3 Task sub-agents in parallel to search the **original JSONL transcript**.

### Agent 1: Resolve FUZZY Items
Search for implementation details, config values, decision rationale. Report as key-value pairs.

### Agent 2: Investigate GAPS
Search for "error", "failed", "reverted", "instead". Report what was tried and what worked.

### Agent 3: Recover QUANTITATIVE UNKNOWNS
Search for ports, versions, paths. Report as a reference table.

## Step 4: Synthesize resume-prompt.md

Write `resume-prompt.md` (250-300 lines) with sections: Context, What Was Accomplished, Current State, Key Decisions, Technical Reference, Known Issues, Files Modified, Next Steps, Instructions for New Session.

## Step 5: Mark Recovery Complete

1. Create the session-complete flag file — write "complete"
2. Tell the user: "Recovery complete. resume-prompt.md has been generated."
3. Stop.
SKILL_EOF

# --- ship skill ---
cat > "$CLAUDE_DIR/skills/ship/SKILL.md" << 'SKILL_EOF'
---
name: ship
description: Commit all changes, push to remote, and optionally create a PR. Usage: /ship or /ship pr
---

Ship the current changes to git. Follow these steps exactly:

## 1. Check status

Run `git status -u` (never use -uall) and `git diff --stat` to understand what changed. If there are no changes, tell the user and stop.

## 2. Stage files

Stage only the relevant project files. NEVER stage:
- `.env`, credentials, secrets
- Large binary files
- Unrelated files that were already untracked before this session

Use specific file paths, not `git add -A`.

## 3. Commit

- Look at `git log --oneline -5` to match the repo's commit message style
- Write a concise commit message summarizing the changes (focus on "why" not "what")
- Use a HEREDOC for the message
- Always include: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## 4. Push

Push to the current branch: `git push origin HEAD`

## 5. PR (only if user said `/ship pr`)

If `$ARGUMENTS` contains "pr":
- Check if a PR already exists for this branch with `gh pr list --head <branch>`
- If no PR exists, create one with `gh pr create` using a clear title and summary
- Return the PR URL

## 6. Report

Tell the user what was committed, pushed, and (if applicable) the PR URL.
SKILL_EOF

# --- interface-design skill ---
cat > "$CLAUDE_DIR/skills/interface-design/SKILL.md" << 'SKILL_EOF'
---
name: interface-design
description: This skill is for interface design — dashboards, admin panels, apps, tools, and interactive products. NOT for marketing design (landing pages, marketing sites, campaigns).
---

# Interface Design

Build interface design with craft and consistency.

## Scope

**Use for:** Dashboards, admin panels, SaaS apps, tools, settings pages, data interfaces.

**Not for:** Landing pages, marketing sites, campaigns. Redirect those to `/frontend-design`.

---

# The Problem

You will generate generic output. Your training has seen thousands of dashboards. The patterns are strong.

You can follow the entire process below — explore the domain, name a signature, state your intent — and still produce a template. Warm colors on cold structures. Friendly fonts on generic layouts. "Kitchen feel" that looks like every other app.

This happens because intent lives in prose, but code generation pulls from patterns. The gap between them is where defaults win.

The process below helps. But process alone doesn't guarantee craft. You have to catch yourself.

---

# Where Defaults Hide

Defaults don't announce themselves. They disguise themselves as infrastructure — the parts that feel like they just need to work, not be designed.

**Typography feels like a container.** Pick something readable, move on. But typography isn't holding your design — it IS your design. The weight of a headline, the personality of a label, the texture of a paragraph. These shape how the product feels before anyone reads a word. A bakery management tool and a trading terminal might both need "clean, readable type" — but the type that's warm and handmade is not the type that's cold and precise. If you're reaching for your usual font, you're not designing.

**Navigation feels like scaffolding.** Build the sidebar, add the links, get to the real work. But navigation isn't around your product — it IS your product. Where you are, where you can go, what matters most. A page floating in space is a component demo, not software. The navigation teaches people how to think about the space they're in.

**Data feels like presentation.** You have numbers, show numbers. But a number on screen is not design. The question is: what does this number mean to the person looking at it? What will they do with it? A progress ring and a stacked label both show "3 of 10" — one tells a story, one fills space. If you're reaching for number-on-label, you're not designing.

**Token names feel like implementation detail.** But your CSS variables are design decisions. `--ink` and `--parchment` evoke a world. `--gray-700` and `--surface-2` evoke a template. Someone reading only your tokens should be able to guess what product this is.

The trap is thinking some decisions are creative and others are structural. There are no structural decisions. Everything is design. The moment you stop asking "why this?" is the moment defaults take over.

---

# Intent First

Before touching code, answer these. Not in your head — out loud, to yourself or the user.

**Who is this human?**
Not "users." The actual person. Where are they when they open this? What's on their mind? What did they do 5 minutes ago, what will they do 5 minutes after? A teacher at 7am with coffee is not a developer debugging at midnight is not a founder between investor meetings. Their world shapes the interface.

**What must they accomplish?**
Not "use the dashboard." The verb. Grade these submissions. Find the broken deployment. Approve the payment. The answer determines what leads, what follows, what hides.

**What should this feel like?**
Say it in words that mean something. "Clean and modern" means nothing — every AI says that. Warm like a notebook? Cold like a terminal? Dense like a trading floor? Calm like a reading app? The answer shapes color, type, spacing, density — everything.

If you cannot answer these with specifics, stop. Ask the user. Do not guess. Do not default.

## Every Choice Must Be A Choice

For every decision, you must be able to explain WHY.

- Why this layout and not another?
- Why this color temperature?
- Why this typeface?
- Why this spacing scale?
- Why this information hierarchy?

If your answer is "it's common" or "it's clean" or "it works" — you haven't chosen. You've defaulted. Defaults are invisible. Invisible choices compound into generic output.

**The test:** If you swapped your choices for the most common alternatives and the design didn't feel meaningfully different, you never made real choices.

## Sameness Is Failure

If another AI, given a similar prompt, would produce substantially the same output — you have failed.

This is not about being different for its own sake. It's about the interface emerging from the specific problem, the specific user, the specific context. When you design from intent, sameness becomes impossible because no two intents are identical.

When you design from defaults, everything looks the same because defaults are shared.

## Intent Must Be Systemic

Saying "warm" and using cold colors is not following through. Intent is not a label — it's a constraint that shapes every decision.

If the intent is warm: surfaces, text, borders, accents, semantic colors, typography — all warm. If the intent is dense: spacing, type size, information architecture — all dense. If the intent is calm: motion, contrast, color saturation — all calm.

Check your output against your stated intent. Does every token reinforce it? Or did you state an intent and then default anyway?

---

# Product Domain Exploration

This is where defaults get caught — or don't.

Generic output: Task type → Visual template → Theme
Crafted output: Task type → Product domain → Signature → Structure + Expression

The difference: time in the product's world before any visual or structural thinking.

## Required Outputs

**Do not propose any direction until you produce all four:**

**Domain:** Concepts, metaphors, vocabulary from this product's world. Not features — territory. Minimum 5.

**Color world:** What colors exist naturally in this product's domain? Not "warm" or "cool" — go to the actual world. If this product were a physical space, what would you see? What colors belong there that don't belong elsewhere? List 5+.

**Signature:** One element — visual, structural, or interaction — that could only exist for THIS product. If you can't name one, keep exploring.

**Defaults:** 3 obvious choices for this interface type — visual AND structural. You can't avoid patterns you haven't named.

## Proposal Requirements

Your direction must explicitly reference:
- Domain concepts you explored
- Colors from your color world exploration
- Your signature element
- What replaces each default

**The test:** Read your proposal. Remove the product name. Could someone identify what this is for? If not, it's generic. Explore deeper.

---

# The Mandate

**Before showing the user, look at what you made.**

Ask yourself: "If they said this lacks craft, what would they mean?"

That thing you just thought of — fix it first.

Your first output is probably generic. That's normal. The work is catching it before the user has to.

## The Checks

Run these against your output before presenting:

- **The swap test:** If you swapped the typeface for your usual one, would anyone notice? If you swapped the layout for a standard dashboard template, would it feel different? The places where swapping wouldn't matter are the places you defaulted.

- **The squint test:** Blur your eyes. Can you still perceive hierarchy? Is anything jumping out harshly? Craft whispers.

- **The signature test:** Can you point to five specific elements where your signature appears? Not "the overall feel" — actual components. A signature you can't locate doesn't exist.

- **The token test:** Read your CSS variables out loud. Do they sound like they belong to this product's world, or could they belong to any project?

If any check fails, iterate before showing.

---

# Craft Foundations

## Subtle Layering

This is the backbone of craft. Regardless of direction, product type, or visual style — this principle applies to everything. You should barely notice the system working. When you look at Vercel's dashboard, you don't think "nice borders." You just understand the structure. The craft is invisible — that's how you know it's working.

### Surface Elevation

Surfaces stack. A dropdown sits above a card which sits above the page. Build a numbered system — base, then increasing elevation levels. In dark mode, higher elevation = slightly lighter. In light mode, higher elevation = slightly lighter or uses shadow.

Each jump should be only a few percentage points of lightness. You can barely see the difference in isolation. But when surfaces stack, the hierarchy emerges. Whisper-quiet shifts that you feel rather than see.

**Key decisions:**
- **Sidebars:** Same background as canvas, not different. Different colors fragment the visual space into "sidebar world" and "content world." A subtle border is enough separation.
- **Dropdowns:** One level above their parent surface. If both share the same level, the dropdown blends into the card and layering is lost.
- **Inputs:** Slightly darker than their surroundings, not lighter. Inputs are "inset" — they receive content. A darker background signals "type here" without heavy borders.

### Borders

Borders should disappear when you're not looking for them, but be findable when you need structure. Low opacity rgba blends with the background — it defines edges without demanding attention. Solid hex borders look harsh in comparison.

Build a progression — not all borders are equal. Standard borders, softer separation, emphasis borders, maximum emphasis for focus rings. Match intensity to the importance of the boundary.

**The squint test:** Blur your eyes at the interface. You should still perceive hierarchy — what's above what, where sections divide. But nothing should jump out. No harsh lines. No jarring color shifts. Just quiet structure.

This separates professional interfaces from amateur ones. Get this wrong and nothing else matters.

## Infinite Expression

Every pattern has infinite expressions. **No interface should look the same.**

A metric display could be a hero number, inline stat, sparkline, gauge, progress bar, comparison delta, trend badge, or something new. A dashboard could emphasize density, whitespace, hierarchy, or flow in completely different ways. Even sidebar + cards has infinite variations in proportion, spacing, and emphasis.

**Before building, ask:**
- What's the ONE thing users do most here?
- What products solve similar problems brilliantly? Study them.
- Why would this interface feel designed for its purpose, not templated?

**NEVER produce identical output.** Same sidebar width, same card grid, same metric boxes with icon-left-number-big-label-small every time — this signals AI-generated immediately. It's forgettable.

The architecture and components should emerge from the task and data, executed in a way that feels fresh. Linear's cards don't look like Notion's. Vercel's metrics don't look like Stripe's. Same concepts, infinite expressions.

## Color Lives Somewhere

Every product exists in a world. That world has colors.

Before you reach for a palette, spend time in the product's world. What would you see if you walked into the physical version of this space? What materials? What light? What objects?

Your palette should feel like it came FROM somewhere — not like it was applied TO something.

**Beyond Warm and Cold:** Temperature is one axis. Is this quiet or loud? Dense or spacious? Serious or playful? Geometric or organic? A trading terminal and a meditation app are both "focused" — completely different kinds of focus. Find the specific quality, not the generic label.

**Color Carries Meaning:** Gray builds structure. Color communicates — status, action, emphasis, identity. Unmotivated color is noise. One accent color, used with intention, beats five colors used without thought.

---

# Before Writing Each Component

**Every time** you write UI code — even small additions — state:

```
Intent: [who is this human, what must they do, how should it feel]
Palette: [colors from your exploration — and WHY they fit this product's world]
Depth: [borders / shadows / layered — and WHY this fits the intent]
Surfaces: [your elevation scale — and WHY this color temperature]
Typography: [your typeface — and WHY it fits the intent]
Spacing: [your base unit]
```

This checkpoint is mandatory. It forces you to connect every technical choice back to intent.

If you can't explain WHY for each choice, you're defaulting. Stop and think.

---

# Design Principles

## Token Architecture

Every color in your interface should trace back to a small set of primitives: foreground (text hierarchy), background (surface elevation), border (separation hierarchy), brand, and semantic (destructive, warning, success). No random hex values — everything maps to primitives.

### Text Hierarchy

Don't just have "text" and "gray text." Build four levels — primary, secondary, tertiary, muted. Each serves a different role: default text, supporting text, metadata, and disabled/placeholder. Use all four consistently. If you're only using two, your hierarchy is too flat.

### Border Progression

Borders aren't binary. Build a scale that matches intensity to importance — standard separation, softer separation, emphasis, maximum emphasis. Not every boundary deserves the same weight.

### Control Tokens

Form controls have specific needs. Don't reuse surface tokens — create dedicated ones for control backgrounds, control borders, and focus states. This lets you tune interactive elements independently from layout surfaces.

## Spacing

Pick a base unit and stick to multiples. Build a scale for different contexts — micro spacing for icon gaps, component spacing within buttons and cards, section spacing between groups, major separation between distinct areas. Random values signal no system.

## Padding

Keep it symmetrical. If one side has a value, others should match unless content naturally requires asymmetry.

## Depth

Choose ONE approach and commit:
- **Borders-only** — Clean, technical. For dense tools.
- **Subtle shadows** — Soft lift. For approachable products.
- **Layered shadows** — Premium, dimensional. For cards that need presence.
- **Surface color shifts** — Background tints establish hierarchy without shadows.

Don't mix approaches.

## Border Radius

Sharper feels technical. Rounder feels friendly. Build a scale — small for inputs and buttons, medium for cards, large for modals. Don't mix sharp and soft randomly.

## Typography

Build distinct levels distinguishable at a glance. Headlines need weight and tight tracking for presence. Body needs comfortable weight for readability. Labels need medium weight that works at smaller sizes. Data needs monospace with tabular number spacing for alignment. Don't rely on size alone — combine size, weight, and letter-spacing.

## Card Layouts

A metric card doesn't have to look like a plan card doesn't have to look like a settings card. Design each card's internal structure for its specific content — but keep the surface treatment consistent: same border weight, shadow depth, corner radius, padding scale.

## Controls

Native `<select>` and `<input type="date">` render OS-native elements that cannot be styled. Build custom components — trigger buttons with positioned dropdowns, calendar popovers, styled state management.

## Iconography

Icons clarify, not decorate — if removing an icon loses no meaning, remove it. Choose one icon set and stick with it. Give standalone icons presence with subtle background containers.

## Animation

Fast micro-interactions, smooth easing. Larger transitions can be slightly longer. Use deceleration easing. Avoid spring/bounce in professional interfaces.

## States

Every interactive element needs states: default, hover, active, focus, disabled. Data needs states too: loading, empty, error. Missing states feel broken.

## Navigation Context

Screens need grounding. A data table floating in space feels like a component demo, not a product. Include navigation showing where you are in the app, location indicators, and user context. When building sidebars, consider same background as main content with border separation rather than different colors.

## Dark Mode

Dark interfaces have different needs. Shadows are less visible on dark backgrounds — lean on borders for definition. Semantic colors (success, warning, error) often need slight desaturation. The hierarchy system still applies, just with inverted values.

---

# Avoid

- **Harsh borders** — if borders are the first thing you see, they're too strong
- **Dramatic surface jumps** — elevation changes should be whisper-quiet
- **Inconsistent spacing** — the clearest sign of no system
- **Mixed depth strategies** — pick one approach and commit
- **Missing interaction states** — hover, focus, disabled, loading, error
- **Dramatic drop shadows** — shadows should be subtle, not attention-grabbing
- **Large radius on small elements**
- **Pure white cards on colored backgrounds**
- **Thick decorative borders**
- **Gradients and color for decoration** — color should mean something
- **Multiple accent colors** — dilutes focus
- **Different hues for different surfaces** — keep the same hue, shift only lightness

---

# Workflow

## Communication
Be invisible. Don't announce modes or narrate process.

**Never say:** "I'm in ESTABLISH MODE", "Let me check system.md..."

**Instead:** Jump into work. State suggestions with reasoning.

## Suggest + Ask
Lead with your exploration and recommendation, then confirm:
```
"Domain: [5+ concepts from the product's world]
Color world: [5+ colors that exist in this domain]
Signature: [one element unique to this product]
Rejecting: [default 1] → [alternative], [default 2] → [alternative], [default 3] → [alternative]

Direction: [approach that connects to the above]"

[Ask: "Does that direction feel right?"]
```

## If Project Has system.md
Read `.interface-design/system.md` and apply. Decisions are made.

## If No system.md
1. Explore domain — Produce all four required outputs
2. Propose — Direction must reference all four
3. Confirm — Get user buy-in
4. Build — Apply principles
5. **Evaluate** — Run the mandate checks before showing
6. Offer to save

---

# After Completing a Task

When you finish building something, **always offer to save**:

```
"Want me to save these patterns for future sessions?"
```

If yes, write to `.interface-design/system.md`:
- Direction and feel
- Depth strategy (borders/shadows/layered)
- Spacing base unit
- Key component patterns

### What to Save

Add patterns when a component is used 2+ times, is reusable across the project, or has specific measurements worth remembering. Don't save one-off components, temporary experiments, or variations better handled with props.

### Consistency Checks

If system.md defines values, check against them: spacing on the defined grid, depth using the declared strategy throughout, colors from the defined palette, documented patterns reused instead of reinvented.

This compounds — each save makes future work faster and more consistent.

---

# Deep Dives

For more detail on specific topics:
- `references/principles.md` — Code examples, specific values, dark mode
- `references/validation.md` — Memory management, when to update system.md
- `references/critique.md` — Post-build craft critique protocol

# Commands

- `/interface-design:status` — Current system state
- `/interface-design:audit` — Check code against system
- `/interface-design:extract` — Extract patterns from code
- `/interface-design:critique` — Critique your build for craft, then rebuild what defaulted
SKILL_EOF

# --- interface-design reference files ---
cat > "$CLAUDE_DIR/skills/interface-design/references/principles.md" << 'REF_EOF'
# Core Craft Principles

These apply regardless of design direction. This is the quality floor.

---

## Surface & Token Architecture

Professional interfaces don't pick colors randomly — they build systems. Understanding this architecture is the difference between "looks okay" and "feels like a real product."

### The Primitive Foundation

Every color in your interface should trace back to a small set of primitives:

- **Foreground** — text colors (primary, secondary, muted)
- **Background** — surface colors (base, elevated, overlay)
- **Border** — edge colors (default, subtle, strong)
- **Brand** — your primary accent
- **Semantic** — functional colors (destructive, warning, success)

Don't invent new colors. Map everything to these primitives.

### Surface Elevation Hierarchy

Surfaces stack. A dropdown sits above a card which sits above the page. Build a numbered system:

```
Level 0: Base background (the app canvas)
Level 1: Cards, panels (same visual plane as base)
Level 2: Dropdowns, popovers (floating above)
Level 3: Nested dropdowns, stacked overlays
Level 4: Highest elevation (rare)
```

In dark mode, higher elevation = slightly lighter. In light mode, higher elevation = slightly lighter or uses shadow. The principle: **elevated surfaces need visual distinction from what's beneath them.**

### The Subtlety Principle

This is where most interfaces fail. Study Vercel, Supabase, Linear — their surfaces are **barely different** but still distinguishable. Their borders are **light but not invisible**.

**For surfaces:** The difference between elevation levels should be subtle — a few percentage points of lightness, not dramatic jumps. In dark mode, surface-100 might be 7% lighter than base, surface-200 might be 9%, surface-300 might be 12%. You can barely see it, but you feel it.

**For borders:** Borders should define regions without demanding attention. Use low opacity (0.05-0.12 alpha for dark mode, slightly higher for light). The border should disappear when you're not looking for it, but be findable when you need to understand the structure.

**The test:** Squint at your interface. You should still perceive the hierarchy — what's above what, where regions begin and end. But no single border or surface should jump out at you. If borders are the first thing you notice, they're too strong. If you can't find where one region ends and another begins, they're too subtle.

**Common AI mistakes to avoid:**
- Borders that are too visible (1px solid gray instead of subtle rgba)
- Surface jumps that are too dramatic (going from dark to light instead of dark to slightly-less-dark)
- Using different hues for different surfaces (gray card on blue background)
- Harsh dividers where subtle borders would do

### Text Hierarchy via Tokens

Don't just have "text" and "gray text." Build four levels:

- **Primary** — default text, highest contrast
- **Secondary** — supporting text, slightly muted
- **Tertiary** — metadata, timestamps, less important
- **Muted** — disabled, placeholder, lowest contrast

Use all four consistently. If you're only using two, your hierarchy is too flat.

### Border Progression

Borders aren't binary. Build a scale:

- **Default** — standard borders
- **Subtle/Muted** — softer separation
- **Strong** — emphasis, hover states
- **Stronger** — maximum emphasis, focus rings

Match border intensity to the importance of the boundary.

### Dedicated Control Tokens

Form controls (inputs, checkboxes, selects) have specific needs. Don't just reuse surface tokens — create dedicated ones:

- **Control background** — often different from surface backgrounds
- **Control border** — needs to feel interactive
- **Control focus** — clear focus indication

This separation lets you tune controls independently from layout surfaces.

### Context-Aware Bases

Different areas of your app might need different base surfaces:

- **Marketing pages** — might use darker/richer backgrounds
- **Dashboard/app** — might use neutral working backgrounds
- **Sidebar** — might differ from main canvas

The surface hierarchy works the same way — it just starts from a different base.

### Alternative Backgrounds for Depth

Beyond shadows, use contrasting backgrounds to create depth. An "alternative" or "inset" background makes content feel recessed. Useful for:

- Empty states in data grids
- Code blocks
- Inset panels
- Visual grouping without borders

---

## Spacing System

Pick a base unit (4px and 8px are common) and use multiples throughout. The specific number matters less than consistency — every spacing value should be explainable as "X times the base unit."

Build a scale for different contexts:
- Micro spacing (icon gaps, tight element pairs)
- Component spacing (within buttons, inputs, cards)
- Section spacing (between related groups)
- Major separation (between distinct sections)

## Symmetrical Padding

TLBR must match. If top padding is 16px, left/bottom/right must also be 16px. Exception: when content naturally creates visual balance.

```css
/* Good */
padding: 16px;
padding: 12px 16px; /* Only when horizontal needs more room */

/* Bad */
padding: 24px 16px 12px 16px;
```

## Border Radius Consistency

Sharper corners feel technical, rounder corners feel friendly. Pick a scale that fits your product's personality and use it consistently.

The key is having a system: small radius for inputs and buttons, medium for cards, large for modals or containers. Don't mix sharp and soft randomly — inconsistent radius is as jarring as inconsistent spacing.

## Depth & Elevation Strategy

Match your depth approach to your design direction. Choose ONE and commit:

**Borders-only (flat)** — Clean, technical, dense. Works for utility-focused tools where information density matters more than visual lift. Linear, Raycast, and many developer tools use almost no shadows — just subtle borders to define regions.

**Subtle single shadows** — Soft lift without complexity. A simple `0 1px 3px rgba(0,0,0,0.08)` can be enough. Works for approachable products that want gentle depth.

**Layered shadows** — Rich, premium, dimensional. Multiple shadow layers create realistic depth. Stripe and Mercury use this approach. Best for cards that need to feel like physical objects.

**Surface color shifts** — Background tints establish hierarchy without any shadows. A card at `#fff` on a `#f8fafc` background already feels elevated.

```css
/* Borders-only approach */
--border: rgba(0, 0, 0, 0.08);
--border-subtle: rgba(0, 0, 0, 0.05);
border: 0.5px solid var(--border);

/* Single shadow approach */
--shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

/* Layered shadow approach */
--shadow-layered:
  0 0 0 0.5px rgba(0, 0, 0, 0.05),
  0 1px 2px rgba(0, 0, 0, 0.04),
  0 2px 4px rgba(0, 0, 0, 0.03),
  0 4px 8px rgba(0, 0, 0, 0.02);
```

## Card Layouts

Monotonous card layouts are lazy design. A metric card doesn't have to look like a plan card doesn't have to look like a settings card.

Design each card's internal structure for its specific content — but keep the surface treatment consistent: same border weight, shadow depth, corner radius, padding scale, typography.

## Isolated Controls

UI controls deserve container treatment. Date pickers, filters, dropdowns — these should feel like crafted objects.

**Never use native form elements for styled UI.** Native `<select>`, `<input type="date">`, and similar elements render OS-native dropdowns that cannot be styled. Build custom components instead:

- Custom select: trigger button + positioned dropdown menu
- Custom date picker: input + calendar popover
- Custom checkbox/radio: styled div with state management

Custom select triggers must use `display: inline-flex` with `white-space: nowrap` to keep text and chevron icons on the same row.

## Typography Hierarchy

Build distinct levels that are visually distinguishable at a glance:

- **Headlines** — heavier weight, tighter letter-spacing for presence
- **Body** — comfortable weight for readability
- **Labels/UI** — medium weight, works at smaller sizes
- **Data** — often monospace, needs `tabular-nums` for alignment

Don't rely on size alone. Combine size, weight, and letter-spacing to create clear hierarchy. If you squint and can't tell headline from body, the hierarchy is too weak.

## Monospace for Data

Numbers, IDs, codes, timestamps belong in monospace. Use `tabular-nums` for columnar alignment. Mono signals "this is data."

## Iconography

Icons clarify, not decorate — if removing an icon loses no meaning, remove it. Choose a consistent icon set and stick with it throughout the product.

Give standalone icons presence with subtle background containers. Icons next to text should align optically, not mathematically.

## Animation

Keep it fast and functional. Micro-interactions (hover, focus) should feel instant — around 150ms. Larger transitions (modals, panels) can be slightly longer — 200-250ms.

Use smooth deceleration easing (ease-out variants). Avoid spring/bounce effects in professional interfaces — they feel playful, not serious.

## Contrast Hierarchy

Build a four-level system: foreground (primary) → secondary → muted → faint. Use all four consistently.

## Color Carries Meaning

Gray builds structure. Color communicates — status, action, emphasis, identity. Unmotivated color is noise. Color that reinforces the product's world is character.

## Navigation Context

Screens need grounding. A data table floating in space feels like a component demo, not a product. Consider including:

- **Navigation** — sidebar or top nav showing where you are in the app
- **Location indicator** — breadcrumbs, page title, or active nav state
- **User context** — who's logged in, what workspace/org

When building sidebars, consider using the same background as the main content area. Rely on a subtle border for separation rather than different background colors.

## Dark Mode

Dark interfaces have different needs:

**Borders over shadows** — Shadows are less visible on dark backgrounds. Lean more on borders for definition.

**Adjust semantic colors** — Status colors (success, warning, error) often need to be slightly desaturated for dark backgrounds.

**Same structure, different values** — The hierarchy system still applies, just with inverted values.
REF_EOF

cat > "$CLAUDE_DIR/skills/interface-design/references/validation.md" << 'REF_EOF'
# Memory Management

When and how to update `.interface-design/system.md`.

## When to Add Patterns

Add to system.md when:
- Component used 2+ times
- Pattern is reusable across the project
- Has specific measurements worth remembering

## Pattern Format

```markdown
### Button Primary
- Height: 36px
- Padding: 12px 16px
- Radius: 6px
- Font: 14px, 500 weight
```

## Don't Document

- One-off components
- Temporary experiments
- Variations better handled with props

## Pattern Reuse

Before creating a component, check system.md:
- Pattern exists? Use it.
- Need variation? Extend, don't create new.

Memory compounds: each pattern saved makes future work faster and more consistent.

---

# Validation Checks

If system.md defines specific values, check consistency:

**Spacing** — All values multiples of the defined base?

**Depth** — Using the declared strategy throughout? (borders-only means no shadows)

**Colors** — Using defined palette, not random hex codes?

**Patterns** — Reusing documented patterns instead of creating new?
REF_EOF

cat > "$CLAUDE_DIR/skills/interface-design/references/critique.md" << 'REF_EOF'
# Critique

Your first build shipped the structure. Now look at it the way a design lead reviews a junior's work — not asking "does this work?" but "would I put my name on this?"

---

## The Gap

There's a distance between correct and crafted. Correct means the layout holds, the grid aligns, the colors don't clash. Crafted means someone cared about every decision down to the last pixel. You can feel the difference immediately — the way you tell a hand-thrown mug from an injection-molded one. Both hold coffee. One has presence.

Your first output lives in correct. This command pulls it toward crafted.

---

## See the Composition

Step back. Look at the whole thing.

Does the layout have rhythm? Great interfaces breathe unevenly — dense tooling areas give way to open content, heavy elements balance against light ones, the eye travels through the page with purpose. Default layouts are monotone: same card size, same gaps, same density everywhere. Flatness is the sound of no one deciding.

Are proportions doing work? A 280px sidebar next to full-width content says "navigation serves content." A 360px sidebar says "these are peers." The specific number declares what matters. If you can't articulate what your proportions are saying, they're not saying anything.

Is there a clear focal point? Every screen has one thing the user came here to do. That thing should dominate — through size, position, contrast, or the space around it. When everything competes equally, nothing wins and the interface feels like a parking lot.

---

## See the Craft

Move close. Pixel-close.

The spacing grid is non-negotiable — every value a multiple of 4, no exceptions — but correctness alone isn't craft. Craft is knowing that a tool panel at 16px padding feels workbench-tight while the same card at 24px feels like a brochure. The same number can be right in one context and lazy in another. Density is a design decision, not a constant.

Typography should be legible even squinted. If size is the only thing separating your headline from your body from your label, the hierarchy is too weak. Weight, tracking, and opacity create layers that size alone can't.

Surfaces should whisper hierarchy. Not thick borders, not dramatic shadows — quiet tonal shifts where you feel the depth without seeing it. Remove every border from your CSS mentally. Can you still perceive the structure through surface color alone? If not, your surfaces aren't working hard enough.

Interactive elements need life. Every button, link, and clickable region should respond to hover and press. Not dramatically — a subtle shift in background, a gentle darkening. Missing states make an interface feel like a photograph of software instead of software.

---

## See the Content

Read every visible string as a user would. Not checking for typos — checking for truth.

Does this screen tell one coherent story? Could a real person at a real company be looking at exactly this data right now? Or does the page title belong to one product, the article body to another, and the sidebar metrics to a third?

Content incoherence breaks the illusion faster than any visual flaw. A beautifully designed interface with nonsensical content is a movie set with no script.

---

## See the Structure

Open the CSS and find the lies — the places that look right but are held together with tape.

Negative margins undoing a parent's padding. Calc() values that exist only as workarounds. Absolute positioning to escape layout flow. Each is a shortcut where a clean solution exists. Cards with full-width dividers use flex column and section-level padding. Centered content uses max-width with auto margins. The correct answer is always simpler than the hack.

---

## Again

Look at your output one final time.

Ask: "If they said this lacks craft, what would they point to?"

That thing you just thought of — fix it. Then ask again.

The first build was the draft. The critique is the design.
REF_EOF

cat > "$CLAUDE_DIR/skills/interface-design/references/example.md" << 'REF_EOF'
# Craft in Action

This shows how the subtle layering principle translates to real decisions. Learn the thinking, not the code. Your values will differ — the approach won't.

---

## The Subtle Layering Mindset

Before looking at any example, internalize this: **you should barely notice the system working.**

When you look at Vercel's dashboard, you don't think "nice borders." You just understand the structure. When you look at Supabase, you don't think "good surface elevation." You just know what's above what. The craft is invisible — that's how you know it's working.

---

## Example: Dashboard with Sidebar and Dropdown

### The Surface Decisions

**Why so subtle?** Each elevation jump should be only a few percentage points of lightness. You can barely see the difference in isolation. But when surfaces stack, the hierarchy emerges. This is the Vercel/Supabase way — whisper-quiet shifts that you feel rather than see.

**What NOT to do:** Don't make dramatic jumps between elevations. That's jarring. Don't use different hues for different levels. Keep the same hue, shift only lightness.

### The Border Decisions

**Why rgba, not solid colors?** Low opacity borders blend with their background. A low-opacity white border on a dark surface is barely there — it defines the edge without demanding attention. Solid hex borders look harsh in comparison.

**The test:** Look at your interface from arm's length. If borders are the first thing you notice, reduce opacity. If you can't find where regions end, increase slightly.

### The Sidebar Decision

**Why same background as canvas, not different?**

Many dashboards make the sidebar a different color. This fragments the visual space — now you have "sidebar world" and "content world."

Better: Same background, subtle border separation. The sidebar is part of the app, not a separate region. Vercel does this. Supabase does this. The border is enough.

### The Dropdown Decision

**Why surface-200, not surface-100?**

The dropdown floats above the card it emerged from. If both were surface-100, the dropdown would blend into the card — you'd lose the sense of layering. Surface-200 is just light enough to feel "above" without being dramatically different.

**Why border-overlay instead of border-default?**

Overlays (dropdowns, popovers) often need slightly more definition because they're floating in space. A touch more border opacity helps them feel contained without being harsh.

---

## Example: Form Controls

### Input Background Decision

**Why darker, not lighter?**

Inputs are "inset" — they receive content, they don't project it. A slightly darker background signals "type here" without needing heavy borders. This is the alternative-background principle.

### Focus State Decision

**Why subtle focus states?**

Focus needs to be visible, but you don't need a glowing ring or dramatic color. A noticeable increase in border opacity is enough for a clear state change. Subtle-but-noticeable — the same principle as surfaces.

---

## Adapt to Context

Your product might need:
- Warmer hues (slight yellow/orange tint)
- Cooler hues (blue-gray base)
- Different lightness progression
- Light mode (principles invert — higher elevation = shadow, not lightness)

**The principle is constant:** barely different, still distinguishable. The values adapt to context.

---

## The Craft Check

Apply the squint test to your work:

1. Blur your eyes or step back
2. Can you still perceive hierarchy?
3. Is anything jumping out at you?
4. Can you tell where regions begin and end?

If hierarchy is visible and nothing is harsh — the subtle layering is working.
REF_EOF

# ============================================
# Make hooks executable
# ============================================
chmod +x "$CLAUDE_DIR/hooks/pre-compact.sh"
chmod +x "$CLAUDE_DIR/hooks/post-compact-inject.sh"
chmod +x "$CLAUDE_DIR/hooks/pre-tool-check.sh"
chmod +x "$CLAUDE_DIR/hooks/pre-bash-check.sh"
chmod +x "$CLAUDE_DIR/hooks/convert-session.py"

echo ""
echo "Global Claude Code configs installed!"
echo ""
echo "  ~/.claude/settings.json     — global hooks (compaction recovery)"
echo "  ~/.claude/hooks/            — 5 hook scripts"
echo "  ~/.claude/agents/           — engineer, executive, user-researcher"
echo "  ~/.claude/docs/             — socratic-questioning, carls-prd-template"
echo "  ~/.claude/skills/           — post-compact, ship, interface-design"
echo ""
echo "These are now available in ALL projects. No per-project setup needed."
echo "Run 'claude' in any project directory to use them."
