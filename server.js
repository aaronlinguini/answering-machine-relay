// server.js
// PURPOSE: Receive frames from the operator and broadcast them to all connected viewers.

import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// PURPOSE: Keep the most recent frame so new viewers see something immediately.
let lastFrame = null;

wss.on("connection", (ws) => {
  if (lastFrame) ws.send(lastFrame);

  ws.on("message", (data) => {
    const frame = data.toString();
    lastFrame = frame;

    // PURPOSE: Broadcast to every connected client (viewers + any other listeners).
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(frame);
    }
  });
});

console.log(`WebSocket relay running on ws://localhost:${PORT}`);