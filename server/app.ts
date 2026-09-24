import express from "express";
import helmet from "helmet";
import passport from "passport";
import cookieParser from "cookie-parser";
import expressSession from "express-session";
import ConnectRedis from "connect-redis";
import morgan from "morgan";
import cors, { CorsOptionsDelegate, CorsRequest } from "cors";
import passportConfig from "./passportConfig";
import redisClient from "./redis";
import swagger from "./swagger";
import logger from "./utils/logger";
import { redactUrl } from "./utils/redact";
import { isAllowedOrigin, isProduction, normalizeOrigin } from "./utils/origins";
import { isAuth } from "./middleware/auth";
import { apiNotFound, errorHandler } from "./middleware/errors";

import authRoutes from "./routes/auth";
import itemsRoutes from "./routes/items";
import lotsRoutes from "./routes/lots";
import itemImagesRoutes from "./routes/itemImages";
import invitationsRoutes from "./routes/invitations";
import analyticsRoutes from "./routes/analytics";
import workspaceMembersRoutes from "./routes/workspaceMembers";
import locationsRoutes from "./routes/locations";
import categoriesRoutes from "./routes/categories";
import suppliersRoutes from "./routes/suppliers";
import customersRoutes from "./routes/customers";
import workspaceRoutes from "./routes/workspace";
import transactionsRoutes from "./routes/transactions";
import dashboardRoutes from "./routes/dashboard";

// ---------------------------------------------------------------------------
// Config checks
// ---------------------------------------------------------------------------

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && isProduction) {
  throw new Error("SESSION_SECRET must be set when NODE_ENV=production. Refusing to start.");
}

// Secure cookies: COOKIE_SECURE=true|false wins; otherwise on in production
// when the public app URL is https. (Defaulting to Secure on a plain-http
// deployment would silently break every login, hence the https check.)
const appOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
const cookieSecure =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : isProduction && !!appOrigin?.startsWith("https://");
if (isProduction && !cookieSecure) {
  logger.warn(
    "Session cookie is NOT marked Secure. Set COOKIE_SECURE=true once the app is served over HTTPS."
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());

// API docs only outside production (mounted after helmet).
if (!isProduction) swagger(app);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const RedisStore = ConnectRedis(expressSession);

export const sessionMiddleware = expressSession({
  name: "inventory.sid",
  store: new RedisStore({ client: redisClient }),
  secret: sessionSecret || "dev-only-insecure-session-secret",
  resave: false,
  saveUninitialized: false,
  proxy: true,
  rolling: true,
  cookie: {
    secure: cookieSecure,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});
app.use(sessionMiddleware);

morgan.token("client-ip", (req: express.Request) => req.ip);
morgan.token("safe-url", (req: express.Request) => redactUrl(req.originalUrl || req.url));
app.use(
  morgan(
    ":client-ip - :method :safe-url HTTP/:http-version :status :res[content-length] - :response-time ms",
    { stream: { write: (message) => logger.info(message.trim()) } }
  )
);

const corsDelegate: CorsOptionsDelegate<CorsRequest> = (req, callback) => {
  const origin = req.headers?.origin as string | undefined;
  // No Origin => same-origin or non-browser client; no CORS headers needed.
  if (!origin) return callback(null, { origin: false, credentials: true });
  const servedHost =
    (req.headers["x-forwarded-host"] as string | undefined) ??
    (req.headers["host"] as string | undefined);
  const allow = isAllowedOrigin(origin, servedHost);
  callback(null, { origin: allow ? origin : false, credentials: true });
};
app.use(cors(corsDelegate));

app.use(cookieParser(process.env.COOKIE_SECRET || sessionSecret));
app.use(passport.initialize());
app.use(passport.session());
passportConfig(passport);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/", (_req, res) => {
  res.status(200).json({ message: "Hello World :)" });
});
app.get("/api/alive", (_req, res) => {
  res.status(200).json({ message: "server is alive invnetory" });
});

app.use("/api/auth", authRoutes);
app.use("/api/invitations", invitationsRoutes); // public (token based)

// Must be mounted before /api/items so "/api/items/images/..." isn't taken as an item id.
app.use("/api/items/images", isAuth, itemImagesRoutes);
app.use("/api/items", isAuth, itemsRoutes);
app.use("/api/lots", isAuth, lotsRoutes);
app.use("/api/analytics", isAuth, analyticsRoutes);
app.use("/api/workspace-members", isAuth, workspaceMembersRoutes);
app.use("/api/locations", isAuth, locationsRoutes);
app.use("/api/categories", isAuth, categoriesRoutes);
app.use("/api/suppliers", isAuth, suppliersRoutes);
app.use("/api/customers", isAuth, customersRoutes);
app.use("/api/workspaces", isAuth, workspaceRoutes);
app.use("/api/transactions", isAuth, transactionsRoutes);
app.use("/api/dashboard", isAuth, dashboardRoutes);

app.use("/api", apiNotFound);
app.use(errorHandler);

export default app;
