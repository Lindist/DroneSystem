const path = require('path');
const os = require('os');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

const WS_PORT = process.env.WS_PORT || 8888;
const HTTP_PORT = process.env.HTTP_PORT || 8000;

// ดึง IPv4 ของเครื่องในวง LAN อัตโนมัติ เพื่อแสดงให้ผู้ใช้ทราบ
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIpAddress();

// ----------------------------------------------------
// 1. WebSocket Server (สำหรับ ESP32-CAM และ React Native)
// ----------------------------------------------------
const wsServer = new WebSocket.Server({ port: WS_PORT }, () => {
  console.log('====================================================');
  console.log(`[WebSocket Server] Running at ws://${localIp}:${WS_PORT}`);
  console.log(`-> ESP32-CAM Destination: ws://${localIp}:${WS_PORT}`);
  console.log(`-> React Native Destination: ws://${localIp}:${WS_PORT}`);
  console.log('====================================================');
});

let connectedClients = new Set();
let stats = {
  totalFrames: 0,
  bytesTransferred: 0,
  lastFrameTime: null,
};

wsServer.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  connectedClients.add(ws);
  console.log(`[WS] Client connected from ${clientIp}. Total active clients: ${connectedClients.size}`);

  ws.on('message', (data, isBinary) => {
    stats.totalFrames++;
    stats.bytesTransferred += data.length || 0;
    stats.lastFrameTime = new Date().toISOString();

    // Broadcast frame ไปยังทุกไคลเอนต์ (React Native, Web browser)
    for (const client of connectedClients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[WS] Client disconnected. Remaining: ${connectedClients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WS Error]', err.message);
    connectedClients.delete(ws);
  });
});

// ----------------------------------------------------
// 2. HTTP Server & Health APIs
// ----------------------------------------------------

// API สถานะการทำงาน ให้แอปมือถือหรือเว็บเช็คได้
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    wsUrl: `ws://${localIp}:${WS_PORT}`,
    activeConnections: connectedClients.size,
    stats,
    serverTime: new Date().toISOString(),
  });
});

// หน้า Web Client จำลอง (เหมือน client.html เดิม สำหรับเปิดดูผ่านเบราว์เซอร์)
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ESP32-CAM Drone Monitor</title>
  <style>
    body {
      background: #0f172a;
      color: #f8fafc;
      font-family: system-ui, sans-serif;
      margin: 0;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .card {
      background: #1e293b;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      max-width: 640px;
      width: 100%;
      text-align: center;
    }
    img {
      width: 100%;
      max-height: 480px;
      background: #000;
      border-radius: 8px;
      object-fit: contain;
    }
    .status {
      margin-top: 12px;
      font-size: 14px;
      color: #38bdf8;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>ESP32-CAM Drone Camera Feed (Web Preview)</h2>
    <img id="stream" alt="Live stream will appear here..." />
    <div class="status" id="status">Connecting to ws://${localIp}:${WS_PORT}...</div>
  </div>
  <script>
    const img = document.getElementById('stream');
    const status = document.getElementById('status');
    const wsUrl = 'ws://' + window.location.hostname + ':${WS_PORT}';
    let ws;
    let urlObject;
    let fps = 0;
    let frameCount = 0;
    setInterval(() => { fps = frameCount; frameCount = 0; }, 1000);

    function connect() {
      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => { status.textContent = 'Connected | ' + wsUrl; };
      ws.onmessage = (e) => {
        frameCount++;
        if (urlObject) URL.revokeObjectURL(urlObject);
        urlObject = URL.createObjectURL(new Blob([e.data]));
        img.src = urlObject;
        status.textContent = 'Live Feed (' + fps + ' FPS) | ' + wsUrl;
      };
      ws.onclose = () => {
        status.textContent = 'Disconnected. Reconnecting in 2s...';
        setTimeout(connect, 2000);
      };
    }
    connect();
  </script>
</body>
</html>
  `);
});

app.listen(HTTP_PORT, () => {
  console.log(`[HTTP Server] Web monitor available at http://${localIp}:${HTTP_PORT}`);
});
