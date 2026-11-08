#!/bin/bash
# Watchdog: keeps the Next.js dev server + live-stream mini-service alive.
# Restarts them if they die. Logs to /home/z/my-project/dev.log and /tmp/live-stream.log.
cd /home/z/my-project

while true; do
  # Next.js dev server (port 3000)
  if ! ss -tlnp 2>/dev/null | grep -q ':3000 '; then
    echo "[watchdog] starting next dev..." >> dev.log
    nohup ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 &
  fi
  # live-stream mini-service (port 3003)
  if ! ss -tlnp 2>/dev/null | grep -q ':3003 '; then
    echo "[watchdog] starting live-stream..." >> /tmp/live-stream.log
    nohup bun run mini-services/live-stream/index.ts >> /tmp/live-stream.log 2>&1 &
  fi
  sleep 4
done
