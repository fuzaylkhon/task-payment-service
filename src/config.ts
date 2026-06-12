import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017/payments",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  webhookSecret: process.env.WEBHOOK_SECRET ?? "test-secret",
  timestampToleranceSec: Number(process.env.TIMESTAMP_TOLERANCE_SEC ?? 300),
  nonceTtlSec: Number(process.env.NONCE_TTL_SEC ?? 600),
};
