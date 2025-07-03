const express = require("express");
const sql = require("mssql");
const http = require("http");
const cors = require("cors");
const { setupWebSocket, espClients } = require("./Websocket/webSetup");
// store broadcast controller
// 👈 your ws logic in websocket.js

const app = express();
const server = http.createServer(app); // 👈 shared server for HTTP and WebSocket
const wsControl = setupWebSocket(server);
app.use(cors());
app.use(express.json());

// 🧠 SQL Server configuration
const dbConfig = {
  user: "AntiShakeAppUser",
  password: "StrongPassword123!",
  server: "localhost",
  database: "AntiShake",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// 📡 API: Receive state update from ESP32
app.post("/api/device/update", async (req, res) => {
  const { device_id, status, tilt, vibration, door_opened } = req.body;

  try {
    const pool = await sql.connect(dbConfig);
    await pool
      .request()
      .input("device_id", sql.VarChar, device_id)
      .input("status", sql.VarChar, status)
      .input("tilt", sql.Bit, tilt)
      .input("vibration", sql.Bit, vibration)
      .input("door_opened", sql.Bit, door_opened).query(`
        INSERT INTO DeviceStatus (device_id, status, tilt, vibration, door_opened, timestamp)
        VALUES (@device_id, @status, @tilt, @vibration, @door_opened, GETDATE())
      `);

    // 📤 Notify all dashboards via WebSocket (broadcast)
    wsControl.broadcast({
      type: "device-update",
      device_id,
      status,
      tilt,
      vibration,
      door_opened,
    });

    res.json({ status: true });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ error: "Failed to update device state" });
  }
});

// 📋 API: Get latest state for a specific device
app.get("/api/device/:id", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().input("id", sql.VarChar, req.params.id)
      .query(`
        SELECT TOP 1 * FROM DeviceStatus
        WHERE device_id = @id
        ORDER BY timestamp DESC
      `);
    res.json(result.recordset[0] || {});
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch device state" });
  }
});

// 🚀 Start HTTP + WS server
server.listen(8080, () => {
  console.log("✅ Server running on http://localhost:8080");
});
