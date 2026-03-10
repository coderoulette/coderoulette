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

# Run the converter
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python3 "$SCRIPT_DIR/convert-session.py" "$TRANSCRIPT_PATH" "$SESSION_DIR/session-transcript.md"

# Create compacted flag
touch "$SESSION_DIR/compacted"

echo "PreCompact: session $SESSION_ID transcript saved to $SESSION_DIR" >&2
