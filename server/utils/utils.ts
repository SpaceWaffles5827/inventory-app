// Rate limiters. Each sensitive endpoint gets its OWN bucket so traffic on one
// (e.g. registrations) can't lock users out of another (e.g. login).
import { Request, Response } from "express";
import { rateLimit, ipKeyGenerator, Options } from "express-rate-limit";
import { errorBody } from "./http";

const MINUTE = 60 * 1000;

const handler = (_req: Request, res: Response) =>
  res.status(429).json(errorBody("Too many attempts. Please try again later."));

const ip = (req: Request) => ipKeyGenerator(req.ip ?? "unknown");
const bodyEmail = (req: Request) =>
  String((req.body as { email?: unknown } | undefined)?.email ?? "")
    .trim()
    .toLowerCase();

// The e2e suite signs up many users from one IP; .test.env sets DISABLE_RATE_LIMIT=true.
// Never honoured in production.
const rateLimitDisabled =
  process.env.DISABLE_RATE_LIMIT === "true" && process.env.NODE_ENV !== "production";

const make = (
  name: string,
  opts: Partial<Options>,
  key: (req: Request) => string = ip
) =>
  rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler,
    skip: () => rateLimitDisabled,
    ...opts,
    keyGenerator: (req) => `${name}:${key(req)}`,
  });

/** 10 failed logins / 15 min per IP + email (successful logins don't count). */
export const loginLimiter = make(
  "login",
  { windowMs: 15 * MINUTE, limit: 10, skipSuccessfulRequests: true },
  (req) => `${ip(req)}:${bodyEmail(req)}`
);

/**
 * 30 failed logins / 15 min per email regardless of IP. Caps brute force even
 * if the client IP can be spoofed (X-Forwarded-For is passed through by the
 * Next.js rewrite proxy; only an edge proxy such as Traefik sanitises it).
 */
export const loginEmailLimiter = make(
  "login-email",
  { windowMs: 15 * MINUTE, limit: 30, skipSuccessfulRequests: true },
  (req) => bodyEmail(req) || ip(req)
);

/** 20 registrations / hour per IP. */
export const registerLimiter = make("register", { windowMs: 60 * MINUTE, limit: 20 });

/** 5 reset emails / 15 min per IP + email. */
export const passwordResetRequestLimiter = make(
  "pwreset-request",
  { windowMs: 15 * MINUTE, limit: 5 },
  (req) => `${ip(req)}:${bodyEmail(req)}`
);

/** 10 reset-token submissions / 15 min per IP. */
export const passwordResetLimiter = make("pwreset", { windowMs: 15 * MINUTE, limit: 10 });

/** 10 password changes / 15 min per signed-in user. */
export const passwordChangeLimiter = make(
  "pwchange",
  { windowMs: 15 * MINUTE, limit: 10 },
  (req) => req.user?.id ?? ip(req)
);

/** 20 invitation verify/accept calls / 15 min per IP. */
export const invitationLimiter = make("invitation", { windowMs: 15 * MINUTE, limit: 20 });
