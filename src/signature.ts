import { createHmac, timingSafeEqual } from "node:crypto";

export function generateHMAC(
  secret: string,
  timestamp: string,
  nonce: string,
  rawBody: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${rawBody}`)
    .digest("hex");
}

export function verifySignature(
  secret: string,
  timestamp: string,
  nonce: string,
  rawBody: string,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(
    generateHMAC(secret, timestamp, nonce, rawBody),
    "utf8",
  );
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
