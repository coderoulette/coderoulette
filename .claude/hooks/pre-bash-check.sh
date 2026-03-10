#!/bin/bash
# PreToolUse hook (matcher: Bash): blocks file-writing Bash commands during
# compaction recovery. Catches shell redirects (>, >>), tee, cp, mv that
# would let Claude bypass the Write/Edit/NotebookEdit block.
# Allows: recovery paths (.claude/sessions/, resume-prompt.md, session-complete)
# Allows: all commands when not in recovery, or when recovery is complete.

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
CWD=$(echo "$INPUT" | jq -r '.cwd')

SESSION_DIR="$CWD/.claude/sessions/$SESSION_ID"

# Fast path: no compacted flag = normal operation, allow everything
if [ ! -f "$SESSION_DIR/compacted" ]; then
    exit 0
fi

# Recovery complete = unblocked, allow everything
if [ -f "$SESSION_DIR/session-complete" ]; then
    exit 0
fi

# Extract the command from tool_input
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
if [ -z "$COMMAND" ]; then
    exit 0
fi

# Detect file-writing patterns in the command.
# We check for: output redirects (> or >>), tee, cp, mv
# Exclude stderr redirects (2>, 2>>)  and comparisons (=>)
HAS_WRITE_PATTERN=false

# Check for > redirect (but not 2>, >>, =>, or -> which are common in non-write contexts)
# Use a broad approach: look for any of the dangerous patterns
if echo "$COMMAND" | grep -qE '(^|[^2=\-])>[^>]|>>|[|]\s*tee\b|\btee\s+-a\b|\btee\s+[^|]|\bcp\s|\bmv\s'; then
    HAS_WRITE_PATTERN=true
fi

# Also catch heredoc patterns (cat << EOF > file, cat > file << EOF)
if echo "$COMMAND" | grep -qE '\bcat\b.*<<.*>|\bcat\b.*>.*<<|\bcat\s*>'; then
    HAS_WRITE_PATTERN=true
fi

# Catch echo/printf redirecting to files
if echo "$COMMAND" | grep -qE '\b(echo|printf)\b.*>'; then
    HAS_WRITE_PATTERN=true
fi

# Catch dd writing to files
if echo "$COMMAND" | grep -qE '\bdd\b.*of='; then
    HAS_WRITE_PATTERN=true
fi

# If no write pattern found, allow the command
if [ "$HAS_WRITE_PATTERN" = false ]; then
    exit 0
fi

# Write pattern detected — check if it targets recovery-allowed paths
# Allow: .claude/sessions/, resume-prompt.md, session-complete
if echo "$COMMAND" | grep -qE '\.claude/sessions/|resume-prompt\.md|session-complete'; then
    exit 0
fi

# Block the write
jq -n '{
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "BLOCKED: Bash file-writing command detected during compaction recovery. You cannot use shell redirects (>, >>), tee, cp, mv, or heredocs to bypass the write block. You MUST follow the COMPACTION RECOVERY REQUIRED instructions: read the session transcript, run gap analysis, spawn 3 research agents, write resume-prompt.md, and create the session-complete flag. Only then will writes be unblocked."
    }
}'
exit 0
