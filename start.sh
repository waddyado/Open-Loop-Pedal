#!/usr/bin/env sh
# Run from project root. First time: npm install
# Optional: chmod +x start.sh
cd "$(dirname "$0")"
echo "Open Loop Pedal - starting dev (Vite + Electron)..."
exec npm run dev
