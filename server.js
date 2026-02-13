// server.js
// PURPOSE: Receive frames from the operator and broadcast them to all connected viewers.
// Stability improvements:
// - Never queue unlimited frames.
// - Skip slow clients instead of building memory pressure.
// - Remove dead clients using ping/pong.
// - Expose /healthz endpoint for Render.

import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 10000;
const MAX_CLIENT_BUFFER = 512 * 1024; // 512 KB
const PING_INTERVAL = 25000;

let lastFrame = null;

// HTTP server (for health checks)
const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200);
    res.end("ok");
    return;
  }

  res.writeHead(200);
  res.end("WebSocket relay running");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  // Immediately send latest frame to new viewer
  if (lastFrame && ws.readyState === 1) {
    try {
      ws.send(lastFrame);
    } catch {}
  }

  ws.on("message", (data) => {
    lastFrame = data;

    for (const client of wss.clients) {
      if (client.readyState !== 1) continue;

      // If client is too far behind, skip this frame (do NOT buffer)
      if (client.bufferedAmount > MAX_CLIENT_BUFFER) continue;

      try {
        client.send(data);
      } catch {}
    }
  });

  ws.on("close", () => {});
  ws.on("error", () => {});
});

// Remove dead clients
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }

    ws.isAlive = false;
    ws.ping();
  }
}, PING_INTERVAL);

server.listen(PORT, () => {
  console.log(`Relay running on port ${PORT}`);
});