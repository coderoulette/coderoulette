#!/bin/bash
# PreToolUse hook: blocks Write/Edit/NotebookEdit during compaction recovery.
# Allows writes to resume-prompt.md and .claude/sessions/ (recovery workspace).
# Fast path: exits immediately if no compacted flag exists.

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
CWD=$(echo "$INPUT" | jq -r '.cwd')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

SESSION_DIR="$CWD/.claude/sessions/$SESSION_ID"

# Fast path: no compacted flag = normal operation, allow everything
if [ ! -f "$SESSION_DIR/compacted" ]; then
    exit 0
fi

# Recovery complete = unblocked, allow everything
if [ -f "$SESSION_DIR/session-complete" ]; then
    exit 0
fi

# Check if this is a write tool
case "$TOOL_NAME" in
    Write|Edit|NotebookEdit)
        ;;
    *)
        # Not a write tool, allow
        exit 0
        ;;
esac

# Check exceptions: allow writes to recovery-related paths
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [ -n "$FILE_PATH" ]; then
    # Allow resume-prompt.md anywhere
    if [[ "$FILE_PATH" == *"resume-prompt.md" ]]; then
        exit 0
    fi
    # Allow writes to session directory
    if [[ "$FILE_PATH" == *"/.claude/sessions/"* ]]; then
        exit 0
    fi
fi

# Block the write
jq -n '{
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "BLOCKED: Compaction recovery is not complete. You MUST follow the COMPACTION RECOVERY REQUIRED instructions that were injected at the top of your context. Read the session transcript, run the gap analysis, spawn the 3 research agents, write resume-prompt.md, and create the session-complete flag. Do NOT attempt to continue previous work until recovery is done."
    }
}'
exit 0
