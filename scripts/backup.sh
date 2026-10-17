#!/usr/bin/env bash
# Backup of the production D1 database into ./backups/ (git-ignored, contains private data).
set -euo pipefail
cd "$(dirname "$0")/.."

DB_NAME="${D1_DATABASE_NAME:-edu-platform}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
mkdir -p backups

echo "Exporting D1 '$DB_NAME' (remote)..."
npx wrangler d1 export "$DB_NAME" --remote --output="backups/d1-${STAMP}.sql"
echo "Saved: backups/d1-${STAMP}.sql"

echo "Don't forget the JSON backup via the app UI (Settings -> Download backup)."
