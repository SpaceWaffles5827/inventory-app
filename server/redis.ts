import Redis from "ioredis";

const isDevMode = process.env.DEV_MODE === "true";
const host = isDevMode ? process.env.REDIS_HOST : "redis";
const port = Number(process.env.REDIS_PORT ?? 6379);

const redisClient = new Redis({
  host,
  port,
});

export default redisClient;
