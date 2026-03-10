#!/bin/bash
# claude-init.sh — ClaudeRoulette project setup
# Run from the project root: bash claude-init.sh
#
# This handles project-specific setup only.
# For global Claude configs (agents, hooks, docs), run claude-global-init.sh first.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Setting up ClaudeRoulette project in: $PROJECT_DIR"

# Check global configs
if [ ! -f "$HOME/.claude/settings.json" ]; then
    echo ""
    echo "Global Claude configs not found. Running claude-global-init.sh first..."
    if [ -f "$PROJECT_DIR/claude-global-init.sh" ]; then
        bash "$PROJECT_DIR/claude-global-init.sh"
    else
        echo "Warning: claude-global-init.sh not found. Run it manually for agents/hooks/docs."
    fi
fi

# Environment files
mkdir -p "$PROJECT_DIR/apps/web" "$PROJECT_DIR/apps/server"

if [ ! -f "$PROJECT_DIR/apps/web/.env.local" ]; then
cat > "$PROJECT_DIR/apps/web/.env.local" << 'EOF'
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-change-me
NEXT_PUBLIC_WS_URL=ws://localhost:3001
EOF
echo "Created apps/web/.env.local"
else
echo "apps/web/.env.local exists, skipping"
fi

if [ ! -f "$PROJECT_DIR/apps/server/.env" ]; then
cat > "$PROJECT_DIR/apps/server/.env" << 'EOF'
PORT=3001
CORS_ORIGIN=http://localhost:3000
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
JWT_SECRET=dev-secret-change-me
EOF
echo "Created apps/server/.env"
else
echo "apps/server/.env exists, skipping"
fi

echo ""
echo "ClaudeRoulette setup complete!"
echo ""
echo "Next steps:"
echo "  1. npm install"
echo "  2. npm run demo    # starts server + web + host agent"
echo "  3. Open http://localhost:3000/dev"
