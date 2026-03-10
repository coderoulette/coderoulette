#!/bin/bash
# SessionStart(compact) hook: injects recovery instructions after compaction.
# Stdout text gets added to Claude's context.
# Only fires when source=compact (matcher in settings.local.json).
#
# Computes concrete absolute paths for the current session and injects them
# as a table before the SKILL.md recovery instructions. This avoids ambiguous
# relative paths or hardcoded project-specific paths in SKILL.md.

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
CWD=$(echo "$INPUT" | jq -r '.cwd')

SESSION_DIR="$CWD/.claude/sessions/$SESSION_ID"

# Only inject if compaction happened and recovery isn't done yet
if [ ! -f "$SESSION_DIR/compacted" ]; then
    exit 0
fi

if [ -f "$SESSION_DIR/session-complete" ]; then
    exit 0
fi

# Compute the JSONL path — Claude Code stores transcripts at:
#   ~/.claude/projects/-{cwd-with-slashes-as-dashes}/{session-id}.jsonl
PROJECT_KEY=$(echo "$CWD" | sed 's|^/||; s|/|-|g')
JSONL_PATH="$HOME/.claude/projects/-${PROJECT_KEY}/${SESSION_ID}.jsonl"

# Emit concrete paths + recovery instructions from SKILL.md
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

SKILL_FILE="$CWD/.claude/skills/post-compact/SKILL.md"

if [ -f "$SKILL_FILE" ]; then
    cat "$SKILL_FILE"
else
    # Fallback if skill file is missing
    cat << 'FALLBACK'
# Post-Compaction Recovery (fallback)

The skill file at .claude/skills/post-compact/SKILL.md is missing.
Perform a minimal recovery:

1. Read the session transcript from the **Session transcript** path in the table above
2. Understand what was in progress
3. Write a resume-prompt.md at the **Resume prompt** path in the table above
4. Create the session-complete flag at the path in the table above
5. Tell the user recovery is complete
FALLBACK
fi
