// src/server/logAuthEvent.ts
import { Request } from "express";
import crypto from "crypto";
import prisma from "../utils/prisma";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";

export type AuthEventType =
  | "login_attempt"
  | "login_success"
  | "login_failure"
  | "2fa_challenge"
  | "2fa_success"
  | "2fa_failure"
  | "logout"
  | "session_revoked"
  | "session_created"
  | "password_reset_request"
  | "password_reset_success"
  | "signup"
  | "email_verify_sent"
  | "email_verify_success";

export type AuthOutcome = "success" | "failure" | "pending";

type JsonValue = Prisma.JsonValue;

function getClientIpString(req: Request): string {
  const xf = String(req.headers["x-forwarded-for"] || "");
  const xri = String(req.headers["x-real-ip"] || "");
  // Prefer X-Real-IP, else left-most XFF, else remoteAddress
  let ip = (
    xri ||
    xf.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    ""
  ).trim();

  // Strip IPv4 with port (e.g., 1.2.3.4:5678)
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.split(":")[0];
  // Strip bracketed IPv6 with port: [::1]:1234
  if (ip.startsWith("[") && ip.includes("]")) ip = ip.slice(1, ip.indexOf("]"));
  // Normalize IPv4-mapped IPv6 (::ffff:1.2.3.4) → 1.2.3.4
  if (
    /^::ffff:/.test(ip) &&
    /\d+\.\d+\.\d+\.\d+$/.test(ip.replace(/^::ffff:/, ""))
  ) {
    ip = ip.replace(/^::ffff:/, "");
  }
  return ip;
}

function uaHash(ua: string): Buffer {
  return crypto.createHash("md5").update(ua).digest(); // BINARY(16)
}

function emailHmac(email?: string | null): string | undefined {
  if (!email) return undefined;
  const secret = process.env.PII_HMAC_SECRET || "CHANGE_ME";
  return crypto
    .createHmac("sha256", secret)
    .update(email.toLowerCase())
    .digest("hex");
}

// HMAC the session id so we never store a replayable token
function sessionRefFrom(raw?: string | null): Buffer | null {
  if (!raw) return null;
  const secret = process.env.LOG_HMAC_SECRET || "CHANGE_ME";
  return crypto.createHmac("sha256", secret).update(String(raw)).digest(); // 32 bytes
}

// Convert IP string to Buffer using inet_pton logic
function ipToBuffer(ip: string | null): Buffer | null {
  if (!ip) return null;

  // Check if IPv4
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    // IPv4: store as IPv4-mapped IPv6 (::ffff:x.x.x.x)
    const octets = ipv4Match.slice(1, 5).map(Number);
    const buffer = Buffer.alloc(16, 0);
    buffer[10] = 0xff;
    buffer[11] = 0xff;
    buffer[12] = octets[0];
    buffer[13] = octets[1];
    buffer[14] = octets[2];
    buffer[15] = octets[3];
    return buffer;
  }

  // IPv6 handling (simplified - you may want a more robust solution)
  // For production, consider using the 'ipaddr.js' library
  try {
    const parts = ip.split(":");
    if (parts.length > 1) {
      // This is a basic IPv6 handler - for production use a proper library
      // like 'ipaddr.js' or 'ip-address'
      return Buffer.from(ip); // Placeholder - implement proper IPv6 conversion
    }
  } catch {
    return null;
  }

  return null;
}

// Get IP version (4 or 6)
function getIpVersion(ip: string | null): number | null {
  if (!ip) return null;
  if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(ip)) return 4;
  if (ip.includes(":")) return 6;
  return null;
}

// Get first 3 bytes of IPv4 for /24 prefix
function getIpv4Prefix24(ip: string | null): Buffer | null {
  if (!ip) return null;
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (ipv4Match) {
    const buffer = Buffer.alloc(3);
    buffer[0] = Number(ipv4Match[1]);
    buffer[1] = Number(ipv4Match[2]);
    buffer[2] = Number(ipv4Match[3]);
    return buffer;
  }
  return null;
}

// Conservative secret-key matcher; DOES NOT match "two_factor_passed"
const SENSITIVE_KEYS =
  /^(password|passphrase|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token|mfa[_-]?code|otp|twofa[_-]?code|totp)$/i;

function sanitizeDetails(
  obj: Record<string, JsonValue> | undefined | null
): Prisma.JsonObject | null {
  if (!obj) return null;
  const out: Record<string, JsonValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : v;
  }
  return Object.keys(out).length ? (out as Prisma.JsonObject) : null;
}

export async function logAuthEvent(ev: {
  req: Request;
  eventType: AuthEventType;
  outcome?: AuthOutcome;
  userId?: string | number | null;
  sessionId?: string | null;
  emailAttempted?: string | null;
  reasonCode?: string | null;
  requestId?: string | null;
  details?: Record<string, Prisma.JsonValue>;
}): Promise<void> {
  try {
    const ip = getClientIpString(ev.req);
    const ua = String(ev.req.headers["user-agent"] || "");

    const sessionRef = sessionRefFrom(
      ev.sessionId ??
        (ev.req as unknown as { sessionID?: string }).sessionID ??
        null
    );

    const requestId =
      ev.requestId ??
      (ev.req.headers["x-request-id"] as string) ??
      (ev.req as unknown as { id?: string }).id ??
      null;

    const emailHmacValue = ev.emailAttempted
      ? emailHmac(ev.emailAttempted)
      : undefined;

    const detailsObj = sanitizeDetails({
      ...(ev.details || {}),
      ...(emailHmacValue ? { email_hmac: emailHmacValue } : {}),
    });

    const id = createId();
    const ipBuffer = ipToBuffer(ip);
    const ipVersion = getIpVersion(ip);
    const ip4Prefix24 = ipVersion === 4 ? getIpv4Prefix24(ip) : null;

    const uaHashValue = uaHash(ua);

    // Use Prisma's type-safe create method
    await prisma.authEvent.create({
      data: {
        id,
        occurredAt: new Date(),
        eventType: ev.eventType,
        outcome: ev.outcome ?? null,
        userId: ev.userId != null ? String(ev.userId) : null,
        sessionRef: sessionRef ? new Uint8Array(sessionRef) : null,
        ip: ipBuffer ? new Uint8Array(ipBuffer) : null,
        uaHash: new Uint8Array(uaHashValue),
        reasonCode: ev.reasonCode ?? null,
        requestId,
        details: detailsObj || undefined,
        ipVersion,
        ip4Prefix24: ip4Prefix24 ? new Uint8Array(ip4Prefix24) : null,
      },
    });
  } catch (e) {
    console.error("[auth_event] insert failed:", e);
  }
}

export function getRequestId(req: Request) {
  return (
    (req.headers["x-request-id"] as string) ||
    (req as unknown as { id?: string }).id ||
    null
  );
}

export const authEvents = {
  loginAttempt: (req: Request, emailAttempted?: string | null) =>
    logAuthEvent({
      req,
      eventType: "login_attempt",
      outcome: "pending",
      emailAttempted,
      requestId: getRequestId(req),
    }),

  loginFailure: (
    req: Request,
    emailAttempted: string | null,
    reasonCode: string,
    details?: Record<string, JsonValue>,
    userId?: string | number | null
  ) =>
    logAuthEvent({
      req,
      eventType: "login_failure",
      outcome: "failure",
      userId,
      emailAttempted,
      reasonCode,
      details,
      requestId: getRequestId(req),
    }),

  loginSuccess: (
    req: Request,
    userId: string | number,
    emailAttempted: string | null,
    details?: Record<string, JsonValue>
  ) =>
    logAuthEvent({
      req,
      eventType: "login_success",
      outcome: "success",
      userId,
      emailAttempted,
      details,
      requestId: getRequestId(req),
    }),

  twoFAChallenge: (
    req: Request,
    userId: string | number,
    emailAttempted: string | null,
    method = "email_code"
  ) =>
    logAuthEvent({
      req,
      eventType: "2fa_challenge",
      outcome: "pending",
      userId,
      emailAttempted,
      reasonCode: "2fa_required",
      details: { method },
      requestId: getRequestId(req),
    }),

  twoFAFailure: (
    req: Request,
    userId: string | number,
    emailAttempted: string | null,
    method = "email_code"
  ) =>
    logAuthEvent({
      req,
      eventType: "2fa_failure",
      outcome: "failure",
      userId,
      emailAttempted,
      reasonCode: "invalid_2fa",
      details: { method },
      requestId: getRequestId(req),
    }),

  twoFASuccess: (
    req: Request,
    userId: string | number,
    emailAttempted: string | null,
    method = "email_code"
  ) =>
    logAuthEvent({
      req,
      eventType: "2fa_success",
      outcome: "success",
      userId,
      emailAttempted,
      details: { method },
      requestId: getRequestId(req),
    }),

  logout: (
    req: Request,
    userId: string | number,
    reasonCode: string | null = null,
    details?: Record<string, JsonValue>
  ) =>
    logAuthEvent({
      req,
      eventType: "logout",
      outcome: "success",
      userId,
      reasonCode,
      details,
      requestId: getRequestId(req),
    }),
};
