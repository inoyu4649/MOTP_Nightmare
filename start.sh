#!/usr/bin/env bash
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "===================================================="
echo "  2026 HAFS Festival x TIMES : Nightmare (MOTP)"
echo "===================================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js not found."
  echo "        Install Node.js 24.18.0+ from https://nodejs.org/"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[SETUP] Installing dependencies (first run only)..."
  npm install
fi

echo "[BUILD] Building client..."
npm run build:client

echo
echo "[START] Server starting... browser will open automatically."
echo "[INFO ] Press Ctrl+C to stop the server."
echo

npm run start
