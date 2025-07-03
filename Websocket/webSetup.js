const WebSocket = require("ws");

// Store ESP clients if needed, but not required for broadcast
const espClients = {};
let connectedClients = new Set(); // ← ALL clients (Flutter, browser, etc.)

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    console.log("🟢 WebSocket client connected");

    connectedClients.add(ws); // ← Track all

    ws.on("message", (message) => {
      try {
        const msg = JSON.parse(message.toString());
        console.log("📩 Received:", msg);

        if (msg.type === "register" && msg.espId) {
          espClients[msg.espId] = ws;
          console.log(`✅ Registered ESP: ${msg.espId}`);
        }

        if (
          msg.type === "control" &&
          msg.espId &&
          msg.pin !== undefined &&
          msg.state !== undefined
        ) {
          const target = espClients[msg.espId];
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify({ pin: msg.pin, state: msg.state }));
            console.log(`🚀 Sent control to ESP ${msg.espId}`);
          }
        }
      } catch (err) {
        console.error("❌ Invalid JSON:", message.toString());
      }
    });

    ws.on("close", () => {
      connectedClients.delete(ws);
      for (const id in espClients) {
        if (espClients[id] === ws) {
          delete espClients[id];
          console.log(`🔴 ESP ${id} disconnected`);
        }
      }
    });

    ws.on("error", (err) => {
      console.error("⚠️ WebSocket error:", err.message);
    });
  });

  console.log("✅ WebSocket server is ready");

  // Expose the broadcast method
  return {
    broadcast: (data) => {
      for (const client of connectedClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      }
    },
  };
}

module.exports = {
  setupWebSocket,
  espClients,
};
