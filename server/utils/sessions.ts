// Session housekeeping for the connect-redis store (keys "sess:<sid>", JSON
// value with passport.user = userId).
import { Request } from "express";
import redisClient from "../redis";
import logger from "./logger";

const PREFIX = "sess:";

/**
 * Delete every stored session of `userId` except `keepSid` (e.g. the session
 * that just changed the password). Uses SCAN, so it is O(total sessions) —
 * fine for password changes / resets, which are rare.
 */
export async function destroyUserSessions(userId: string, keepSid?: string): Promise<number> {
  let removed = 0;
  let cursor = "0";
  try {
    do {
      const [next, keys] = await redisClient.scan(cursor, "MATCH", `${PREFIX}*`, "COUNT", 500);
      cursor = next;
      if (keys.length === 0) continue;
      const values = await redisClient.mget(...keys);
      const doomed: string[] = [];
      keys.forEach((key, i) => {
        if (keepSid && key === `${PREFIX}${keepSid}`) return;
        const raw = values[i];
        if (!raw) return;
        try {
          const sess = JSON.parse(raw) as { passport?: { user?: string } };
          if (sess?.passport?.user === userId) doomed.push(key);
        } catch {
          /* not a session we understand */
        }
      });
      if (doomed.length) removed += await redisClient.del(...doomed);
    } while (cursor !== "0");
  } catch (err) {
    logger.error("failed to revoke user sessions", { userId, error: String(err) });
  }
  return removed;
}

export const regenerateSession = (req: Request) =>
  new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  );

export const loginSession = (req: Request, user: Express.User) =>
  new Promise<void>((resolve, reject) =>
    req.login(user, (err) => (err ? reject(err) : resolve()))
  );

export const logoutSession = (req: Request) =>
  new Promise<void>((resolve, reject) =>
    req.logout((err) => (err ? reject(err) : resolve()))
  );

export const destroySession = (req: Request) =>
  new Promise<void>((resolve) => {
    if (!req.session) return resolve();
    req.session.destroy((err) => {
      if (err) logger.error("session destroy failed", { error: String(err) });
      resolve();
    });
  });
