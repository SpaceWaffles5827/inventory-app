import express from "express";
import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import bodyParser from "body-parser";
import passport from "passport";
import cookieParser from "cookie-parser";
import passportConfig from "./passportConfig";
import expressSession from "express-session";
import ConnectRedis from "connect-redis";
import redisClient from "./redis";
import swagger from "./swagger";
import morgan from "morgan";
import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import cors, { CorsOptionsDelegate, CorsRequest } from "cors";

const app = express();
swagger(app);

app.set("trust proxy", 1);

const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      dirname: "logs", // folder
      filename: "app-%DATE%.log", // name pattern
      datePattern: "YYYY-MM-DD", // logs split daily
      maxFiles: "14d", // keep logs for 14 days
      maxSize: "20m", // rotate when log file reaches 20 MB
      zippedArchive: true, // compress old logs to save space
    }),
  ],
});

const isAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized", data: null });
};

app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize RedisStore with express-session
const RedisStore = ConnectRedis(expressSession);

app.use(
  expressSession({
    name: "inventory.sid",
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
    rolling: true,
  })
);

morgan.token("client-ip", (req: Request) => req.ip);

app.use(
  morgan(
    ":client-ip - :method :url HTTP/:http-version :status :res[content-length] - :response-time ms",
    {
      stream: {
        write: (message) => {
          logger.info(message.trim());
        },
      },
    }
  )
);

const stripPort = (h: string) => h.split(",")[0].trim().replace(/:\d+$/, "");
const isPrivateHost = (host: string) =>
  /^localhost$|^127\.0\.0\.1$|^10\.\d+\.\d+\.\d+$|^192\.168\.\d+\.\d+$|^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(
    host
  );

// Static seeds you always allow
const STATIC_ORIGINS = new Set<string>([
  "https://inventory-app.com",
  "http://localhost:3000",
  "http://localhost:80",
  "http://localhost:5001",
  "http://localhost:" + process.env.TRAEFIK_HTTP_PORT,
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
]);

const corsDelegate: CorsOptionsDelegate<CorsRequest> = (req, callback) => {
  // Node lower-cases header keys
  const reqOrigin = req.headers?.origin as string | undefined;

  // No Origin => same-origin or non-browser; don't add CORS headers
  if (!reqOrigin) return callback(null, { origin: false, credentials: true });

  let allow = false;
  try {
    const originURL = new URL(reqOrigin);
    const originHost = stripPort(originURL.host);

    const servedHostHeader =
      (req.headers["x-forwarded-host"] as string | undefined) ??
      (req.headers["host"] as string | undefined) ??
      "";
    const servedHost = stripPort(servedHostHeader);

    const allowed = new Set(STATIC_ORIGINS);
    if (servedHost) {
      allowed.add(`http://${servedHost}`);
      allowed.add(`https://${servedHost}`);
    }

    allow =
      allowed.has(reqOrigin) ||
      allowed.has(`http://${originHost}`) ||
      allowed.has(`https://${originHost}`) ||
      isPrivateHost(originHost);
  } catch {
    allow = false;
  }

  // With credentials=true, echo the exact Origin when allowed
  callback(null, { origin: allow ? reqOrigin : false, credentials: true });
};

// Use this BEFORE your routes
app.use(cors(corsDelegate));

app.use(cookieParser(process.env.COOKIE_SECRET || process.env.SESSION_SECRET));
app.use(passport.initialize());
app.use(passport.session());
passportConfig(passport);

import authRoutes from "./routes/auth";
app.use("/api/auth", authRoutes);

import itemsRoutes from "./routes/items";
app.use("/api/items", isAuth, itemsRoutes);

import invitationsRoutes from "./routes/invitations";
app.use("/api/invitations", invitationsRoutes);

import analyticsRoutes from "./routes/analytics";
app.use("/api/analytics", isAuth, analyticsRoutes);

import workspaceMembersRoutes from "./routes/workspaceMembers";
app.use("/api/workspace-members", isAuth, workspaceMembersRoutes);

import locationsRoutes from "./routes/locations";
app.use("/api/locations", isAuth, locationsRoutes);

import categoriesRoutes from "./routes/categories";
app.use("/api/categories", isAuth, categoriesRoutes);

import suppliersRoutes from "./routes/suppliers";
app.use("/api/suppliers", isAuth, suppliersRoutes);

import groupRoutes from "./routes/workspace";
app.use("/api/workspaces", isAuth, groupRoutes);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Hello World :)" });
});

app.get("/api/alive", (req, res) => {
  res.status(200).json({ message: "server is alive invnetory" });
});

export default app;
