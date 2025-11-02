// server/index.ts
import http from "http";
import app from "./app";
import {
  setupConnectionTracker,
  mountActiveConnectionsRoute,
} from "./connectionTracker";
import geoip from "geoip-lite";
import { Server as SocketIOServer, Socket } from "socket.io";

// Port configuration
type Port = number;
const PORT: Port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;

// 1) Create the HTTP server around your Express app
const server = http.createServer(app);

// 2) (Optional) Mount REST fallback endpoint for polling
mountActiveConnectionsRoute(app);

// 3) (Optional) Hook raw TCP-socket tracking
setupConnectionTracker(server);

// 4) Prepare a clean array of allowed origins
const allowedOrigins = [
  "https://inventory-app.com",
  "http://localhost:3000",
  "http://localhost:80",
  "https://thespacewaffles.com",
  "http://localhost:5001",
  "http://localhost:" + process.env.TRAEFIK_HTTP_PORT,
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
];

// 5) Initialize Socket.IO for live updates
const io = new SocketIOServer(server, {
  path: "/api/livesocket", // ← handshake now under /api/livesocket
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// 6) Maintain a live Set of client IP addresses
const activeClients = new Set<string>();

io.on("connection", (socket: Socket) => {
  // 1) Prefer the first entry in X-Forwarded-For, otherwise use the TCP address
  const xff = socket.handshake.headers["x-forwarded-for"];
  const ip =
    typeof xff === "string"
      ? xff.split(",")[0].trim()
      : socket.handshake.address;

  activeClients.add(ip);

  // Helper to emit the current set with GeoIP lookups
  const publishConnections = () => {
    const payload = Array.from(activeClients).map((addr) => ({
      ip: addr,
      geo: geoip.lookup(addr) || null,
    }));
    io.emit("active-connections", payload);
  };

  // Broadcast immediately after connect
  publishConnections();

  socket.on("disconnect", () => {
    activeClients.delete(ip);
    publishConnections();
  });
});

// 7) Start listening
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
