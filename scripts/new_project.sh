#!/usr/bin/env bash
# Scaffold a promo project from the template:  bash new_project.sh <target-dir>
# Creates a standalone Remotion project (keep it OUTSIDE the app repo), installs deps with pnpm.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
T="$1"
[ -e "$T/package.json" ] && { echo "$T already has a package.json - not overwriting"; exit 1; }
mkdir -p "$T"
cp -r "$SKILL/assets/template/." "$T/"
mv "$T/gitignore.txt" "$T/.gitignore"
mkdir -p "$T/public/clips" "$T/public/stills/ui" "$T/public/audio" "$T/captures" "$T/out" "$T/scripts"
# web capture runs from the project so Node resolves playwright-core from the project's node_modules
cp "$SKILL/scripts/web_capture.mjs" "$T/scripts/"
cd "$T" && git init -q && pnpm install --silent
echo "scaffolded $T - next: capture the real UI (references/capture-android.md or capture-web.md)"
