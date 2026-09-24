// server/index.ts
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import passport from "passport";
import app, { sessionMiddleware } from "./app";
import { isAllowedOrigin } from "./utils/origins";
import logger from "./utils/logger";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;

const server = http.createServer(app);

// Socket.IO for live updates. Same origin policy as the REST API, and only
// authenticated sessions may connect. Nothing identifying (IPs, geo, names)
// is broadcast — only an anonymous connection count.
const io = new SocketIOServer(server, {
  path: "/api/livesocket",
  cors: {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      callback(null, isAllowedOrigin(origin));
    },
  },
});

io.engine.use(sessionMiddleware);
io.engine.use(passport.initialize());
io.engine.use(passport.session());

io.use((socket, next) => {
  const req = socket.request as http.IncomingMessage & { user?: Express.User };
  if (req.user?.id) return next();
  next(new Error("unauthorized"));
});

const publishConnectionCount = () => {
  io.emit("active-connections", { count: io.engine.clientsCount });
};

io.on("connection", (socket) => {
  publishConnectionCount();
  socket.on("disconnect", publishConnectionCount);
});

server.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
