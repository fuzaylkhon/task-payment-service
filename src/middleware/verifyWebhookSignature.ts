import type { RequestHandler } from "express";
import { ConflictError, UnauthorizedError, ValidationError } from "../errors";
import type { NonceStore } from "../types";
import { verifySignature } from "../signature";
import { nowUnixSeconds } from "../utils";

export interface WebhookGuardOptions {
  nonceStore: NonceStore;
  secret: string;
  timestampToleranceSec: number;
  nonceTtlSec: number;
}

export function verifyWebhookSignature(
  opts: WebhookGuardOptions,
): RequestHandler {
  return async (req, _res, next) => {
    const signature = req.get("X-Signature");
    const timestamp = req.get("X-Timestamp");
    const nonce = req.get("X-Nonce");

    if (!signature || !timestamp || !nonce) {
      throw new ValidationError("missing signature headers");
    }

    // timestamp check
    const ts = Number.parseInt(timestamp, 10);
    if (
      !Number.isFinite(ts) ||
      Math.abs(nowUnixSeconds() - ts) > opts.timestampToleranceSec
    ) {
      throw new UnauthorizedError("stale or invalid timestamp");
    }

    // HMAC
    if (
      !verifySignature(
        opts.secret,
        timestamp,
        nonce,
        req.rawBody ?? "",
        signature,
      )
    ) {
      throw new UnauthorizedError("invalid signature");
    }

    // uniqness check
    const stored = await opts.nonceStore.set(
      `webhook:nonce:${nonce}`,
      "1",
      "EX",
      opts.nonceTtlSec,
      "NX",
    );
    if (stored !== "OK") throw new ConflictError("nonce already used");

    next();
  };
}
