# Post-Compaction Recovery

You are running the post-compaction recovery process. A compaction event just occurred, and the full pre-compaction transcript has been saved to Markdown. Your job is to analyze it, recover lost context, and generate a handoff document.

**IMPORTANT**: All paths you need are in the **Concrete Paths** table injected above this section. Use those exact absolute paths — do NOT construct paths yourself.

## Step 1: Read the Session Transcript

Read the file at the **Session transcript** path from the Concrete Paths table. This contains the compact version of the full JSONL transcript from before compaction (~1-2% of original size). Read the entire file.

## Step 2: Gap Analysis

After reading the transcript, categorize your knowledge into four buckets:

### CLEAR
Things you fully understand from the transcript + post-compaction context:
- What was the user's overall goal?
- What files were created/modified?
- What's the current state of the project?

### FUZZY
Things you partially understand but lack specifics:
- Implementation details that were discussed but you can't fully reconstruct
- Configuration values or patterns that were referenced
- Decisions that were made but whose rationale is unclear

### GAPS
Things you know happened but can't reconstruct:
- Error messages and their resolutions
- Test results and their outcomes
- Ideas that were proposed then reverted or abandoned
- Specific code that was written (tool_result content was stripped)

### QUANTITATIVE UNKNOWNS
Specific values you'd need to verify:
- Port numbers, version strings, file paths
- Command outputs or API responses
- Counts, sizes, performance numbers

## Step 3: Parallel Sub-Agent Research

Spawn exactly 3 Task sub-agents in parallel to search the **original JSONL transcript** (use the **Original JSONL transcript** path from the Concrete Paths table — do NOT construct this path yourself).

**Important**: Tell each agent to use `Grep` and `Read` on the JSONL file to find specific details. The JSONL contains the complete conversation including all tool results.

### Agent 1: Resolve FUZZY Items
- Search for implementation details, config values, and decision rationale
- Look for patterns: specific code snippets, configuration blocks, architectural decisions
- Report findings as structured key-value pairs

### Agent 2: Investigate GAPS
- Search for error messages, test results, and reverted decisions
- Look for patterns: "error", "failed", "reverted", "instead", "actually"
- Report what was tried, what failed, and what ultimately worked

### Agent 3: Recover QUANTITATIVE UNKNOWNS
- Search for specific ports, versions, paths, and commands
- Look for patterns: numbers after "port", version strings, absolute paths
- Report as a structured reference table

## Step 4: Synthesize resume-prompt.md

After all 3 agents return, write `resume-prompt.md` at the **Resume prompt** path from the Concrete Paths table.

The resume-prompt.md should be 250-300 lines and contain these sections:

```markdown
# Session Resume: {brief description}

## Context
{1-2 paragraphs: what this project is, what the session was working on}

## What Was Accomplished
{Bulleted list of completed work with specific file references}

## Current State
{What's done, what's in progress, what's pending}

## Key Decisions Made
{Important architectural/design decisions with rationale}

## Technical Reference
{Ports, paths, versions, config values — recovered quantitative data}

## Known Issues & Resolutions
{Errors encountered, what was tried, what fixed them}

## Files Modified
{List of files with brief description of changes}

## Immediate Next Steps
{What should happen next in the session}

## Instructions for New Session
Read this file, then continue with the next steps listed above.
Do NOT re-read or re-analyze files that are described here unless
you need to modify them. Trust this document as accurate.
```

## Step 5: Mark Recovery Complete

After writing resume-prompt.md:

1. Create the **Session-complete flag** file (path in Concrete Paths table) — write "complete" to it
2. Tell the user: "Recovery complete. resume-prompt.md has been generated. You can now start a fresh session — the session watcher will auto-spawn one, or you can manually run `claude` and point it at the resume-prompt.md."
3. Stop.
