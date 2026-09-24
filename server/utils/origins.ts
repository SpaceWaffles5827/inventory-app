// Allowed browser origins, shared by Express CORS and Socket.IO.
//
// Production (NODE_ENV=production): ONLY the origins in CORS_ORIGINS
// (comma-separated) plus NEXT_PUBLIC_APP_URL.
// Development: additionally localhost / 127.0.0.1 / private-network hosts and
// the host the request was served on, for LAN testing on phones etc.
export const isProduction = process.env.NODE_ENV === "production";

export function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return null;
  }
}

const configuredOrigins = new Set(
  [
    ...(process.env.CORS_ORIGINS ?? "").split(","),
    process.env.NEXT_PUBLIC_APP_URL,
  ]
    .map((o) => normalizeOrigin(o))
    .filter((o): o is string => !!o)
);

const PRIVATE_HOST =
  /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/;

const stripPort = (h: string) => h.split(",")[0].trim().replace(/:\d+$/, "").toLowerCase();

export function isAllowedOrigin(origin: string, servedHost?: string): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (configuredOrigins.has(normalized)) return true;
  if (isProduction) return false;

  const host = stripPort(new URL(normalized).host);
  if (PRIVATE_HOST.test(host)) return true;
  if (servedHost && stripPort(servedHost) === host) return true;
  return false;
}

export const allowedOriginList = () => Array.from(configuredOrigins);
