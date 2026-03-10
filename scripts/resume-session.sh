#!/bin/bash
# Find the most recent resume-prompt.md across all session directories.
# Uses `find` instead of shell globs to avoid zsh "no matches found" errors.

set -euo pipefail

SESSIONS_DIR="${1:-.}/.claude/sessions"

if [ ! -d "$SESSIONS_DIR" ]; then
    echo "Error: no sessions directory at $SESSIONS_DIR" >&2
    exit 1
fi

# find + xargs ls -td: sort by modification time, most recent first
# Works on both macOS and Linux; gracefully returns nothing if no matches.
LATEST=$(find "$SESSIONS_DIR" -name "resume-prompt.md" -type f -print0 2>/dev/null \
    | xargs -0 ls -td 2>/dev/null \
    | head -1)

if [ -z "$LATEST" ]; then
    echo "Error: no resume-prompt.md found in any session" >&2
    exit 1
fi

echo "$LATEST"
