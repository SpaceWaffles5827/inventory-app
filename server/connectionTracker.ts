// server/connectionTracker.ts
import { Express, Request, Response, NextFunction } from "express";
import http from "http";
import { Socket } from "net";
import geoip from "geoip-lite";

// Map every open socket → client IP
type SockInfo = {
  ip: string;
  userId?: string | number | null;
  userFirstName?: string | null;
  userLastName?: string | null;
};

const activeSockets = new Map<Socket, SockInfo>();

export function setupConnectionTracker(server: http.Server) {
  server.on("connection", (socket: Socket) => {
    const ip = socket.remoteAddress || "";
    activeSockets.set(socket, { ip });
    socket.on("close", () => activeSockets.delete(socket));
  });
  // ← use this in Express after your auth middleware
  function attachUserFromReq(req: Request, _res: Response, next: NextFunction) {
    const s = req.socket;
    const u = req.user; // set by your auth layer

    if (s) {
      const existing: SockInfo = activeSockets.get(s) ?? {
        ip: s.remoteAddress || "",
      };
      activeSockets.set(s, {
        ...existing,
        userId: u?.id ?? null,
        userFirstName: u?.name ?? null,
      });

      // ensure cleanup even if someone calls setup late
      if (!s.listenerCount("close")) {
        s.once("close", () => activeSockets.delete(s));
      }
    }
    next();
  }

  return attachUserFromReq;
}

export function mountActiveConnectionsRoute(app: Express) {
  app.get("/api/active-connections", (req: Request, res: Response) => {
    const user = req.user;
    const uniqueIps = Array.from(new Set(activeSockets.values()));
    const clients = uniqueIps.map((ip) => ({
      ip,
      geo: geoip.lookup(ip.ip) || {},
      userId: user?.id || null,
      userFirstName: user?.name || null,
    }));
    res.json(clients);
  });
}
