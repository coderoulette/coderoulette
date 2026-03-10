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
    """Extract structured info from message content (string or list of blocks)."""
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
                # Truncate thinking to 500 chars
                if len(text) > 500:
                    text = text[:500] + f"\n... [truncated {len(text)} chars]"
                parts.append(("thinking", text))

        elif btype == "tool_use":
            name = block.get("name", "?")
            inp = block.get("input", {})
            # Extract key identifiers from tool input
            summary = summarize_tool_input(name, inp)
            parts.append(("tool_use", f"{name}: {summary}"))

        elif btype == "tool_result":
            # Discard tool_result content entirely - too verbose
            pass

    return parts


def summarize_tool_input(name, inp):
    """Create a one-line summary of a tool invocation."""
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
        if len(cmd) > 120:
            cmd = cmd[:120] + "..."
        return cmd

    if name == "Glob":
        return inp.get("pattern", "?")

    if name == "Grep":
        return f"/{inp.get('pattern', '?')}/ in {inp.get('path', '.')}"

    if name == "Task":
        desc = inp.get("description", inp.get("prompt", "?"))
        if len(desc) > 100:
            desc = desc[:100] + "..."
        return desc

    if name == "WebFetch":
        return inp.get("url", "?")

    if name == "WebSearch":
        return inp.get("query", "?")

    if name in ("TaskCreate", "TaskUpdate", "TaskList", "TaskGet"):
        subj = inp.get("subject", inp.get("taskId", ""))
        return subj

    if name == "NotebookEdit":
        return inp.get("notebook_path", "?")

    # Fallback: first key=value pairs
    items = list(inp.items())[:3]
    return ", ".join(f"{k}={str(v)[:40]}" for k, v in items)


def convert_jsonl_to_md(input_path, output_path):
    """Main conversion: JSONL -> compact Markdown."""
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

            # Skip noise
            if rtype == "file-history-snapshot":
                skipped["file-history-snapshot"] += 1
                continue
            if rtype == "progress":
                skipped["progress"] += 1
                continue

            # Skip sidechain messages (sub-agent internals)
            if record.get("isSidechain", False):
                continue

            records.append(record)

    # Sort by timestamp if available
    def get_ts(r):
        ts = r.get("timestamp", "")
        if ts:
            try:
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass
        return datetime.min.replace(tzinfo=timezone.utc)

    records.sort(key=get_ts)

    # Build markdown
    lines = []
    session_id = None
    first_ts = None
    last_ts = None
    turn_count = 0
    user_msgs = 0
    assistant_msgs = 0
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
            # System messages: include but truncate
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

            # Filter out tool_result blocks from user messages (they carry tool output)
            text_parts = [p for p in parts if p[0] == "text"]
            if text_parts:
                lines.append(f"\n---\n### USER [{ts[:19] if ts else '?'}] (Turn {turn_count})")
                for ptype, ptext in text_parts:
                    # Truncate very long user messages
                    if len(ptext) > 2000:
                        ptext = ptext[:2000] + f"\n... [truncated {len(ptext)} chars]"
                    lines.append(ptext)

            # Count tool_results for stats but don't include content
            result_parts = [p for p in parts if p[0] != "text"]
            skipped["tool_result"] += len(result_parts)

        elif role == "assistant":
            assistant_msgs += 1
            parts = parse_content_blocks(content)

            if not parts:
                continue

            has_text = any(p[0] == "text" for p in parts)
            has_tools = any(p[0] == "tool_use" for p in parts)
            has_thinking = any(p[0] == "thinking" for p in parts)

            if has_text or has_tools or has_thinking:
                lines.append(f"\n### ASSISTANT [{ts[:19] if ts else '?'}]")

            for ptype, ptext in parts:
                if ptype == "thinking":
                    lines.append(f"**Thinking:**")
                    lines.append(f"> {ptext}")
                elif ptype == "text":
                    # Truncate long assistant text
                    if len(ptext) > 1500:
                        ptext = ptext[:1500] + f"\n... [truncated {len(ptext)} chars]"
                    lines.append(ptext)
                elif ptype == "tool_use":
                    lines.append(f"- `{ptext}`")
                    tool_uses.append(ptext)
                    # Track files
                    for token in ptext.split():
                        if "/" in token and not token.startswith("http"):
                            clean = token.strip("'\"(),")
                            if os.path.sep in clean or clean.startswith("/"):
                                files_touched.add(clean)

    # Build header
    header_lines = [
        f"# Session Transcript: {session_id}",
        "",
        "## Stats",
        f"- **First message:** {first_ts or '?'}",
        f"- **Last message:** {last_ts or '?'}",
        f"- **Turns:** {turn_count}",
        f"- **User messages:** {user_msgs}",
        f"- **Assistant messages:** {assistant_msgs}",
        f"- **Tool invocations:** {len(tool_uses)}",
        f"- **Original JSONL size:** {total_bytes:,} bytes",
        f"- **Skipped records:** {json.dumps(skipped)}",
        "",
    ]

    if files_touched:
        header_lines.append("## Files Touched")
        for fp in sorted(files_touched):
            header_lines.append(f"- `{fp}`")
        header_lines.append("")

    header_lines.append("## Transcript\n")

    output = "\n".join(header_lines + lines) + "\n"

    with open(output_path, "w") as f:
        f.write(output)

    output_bytes = len(output.encode("utf-8"))
    reduction = (1 - output_bytes / total_bytes) * 100 if total_bytes > 0 else 0

    print(f"Converted: {total_bytes:,} bytes -> {output_bytes:,} bytes ({reduction:.1f}% reduction)")
    print(f"Turns: {turn_count}, Tool uses: {len(tool_uses)}, Files: {len(files_touched)}")

    return 0


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.jsonl> <output.md>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found", file=sys.stderr)
        sys.exit(1)

    sys.exit(convert_jsonl_to_md(input_path, output_path))


if __name__ == "__main__":
    main()
