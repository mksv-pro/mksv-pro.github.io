#!/usr/bin/env bash
# Local preview: rebuild, serve public/ on :8765, open the browser. Ctrl+C (or closing the window) stops it.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=8765
URL="http://localhost:$PORT/"

if ss -ltn | grep -q ":$PORT "; then   # already running: just open it
  xdg-open "$URL" >/dev/null 2>&1 &
  exit 0
fi

python3 tools/build/build.py
(sleep 1 && xdg-open "$URL" >/dev/null 2>&1) &
echo "Serving $URL — Ctrl+C to stop"
exec python3 -m http.server -d public -b 127.0.0.1 "$PORT"
