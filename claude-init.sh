#!/bin/bash
# claude-init.sh — CodeRoulette local development setup
# Run from the project root: bash claude-init.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Setting up CodeRoulette in: $PROJECT_DIR"

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
echo "CodeRoulette setup complete!"
echo ""
echo "Next steps:"
echo "  1. npm install"
echo "  2. Edit .env files with your GitHub OAuth credentials"
echo "  3. npm run dev     # starts server + web app"
echo "  4. npm run demo    # starts server + web + host agent"
