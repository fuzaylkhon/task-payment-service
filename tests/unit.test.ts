import { describe, test, expect } from "vitest";
import { calculateFee } from "../src/services/fees";
import { generateHMAC, verifySignature } from "../src/signature";

describe("calculateFee", () => {
  test("10000 at 2.5% -> fee 250, receive 9750", () => {
    expect(calculateFee(10000, 2.5)).toEqual({
      fee: 250,
      amountToReceive: 9750,
    });
  });

  test("rounds to nearest minor unit", () => {
    expect(calculateFee(999, 2.5)).toEqual({ fee: 25, amountToReceive: 974 });
  });

  test("zero percent", () => {
    expect(calculateFee(500, 0)).toEqual({ fee: 0, amountToReceive: 500 });
  });
});

describe("HMAC signature", () => {
  const secret = "s3cret";
  const ts = "1700000000";
  const nonce = "abc";
  const body = '{"invoiceId":"1","status":"paid"}';

  test("valid signature verifies", () => {
    const sig = generateHMAC(secret, ts, nonce, body);
    expect(verifySignature(secret, ts, nonce, body, sig)).toBe(true);
  });

  test("tampered body fails", () => {
    const sig = generateHMAC(secret, ts, nonce, body);
    expect(
      verifySignature(secret, ts, nonce, body.replace("paid", "fail"), sig),
    ).toBe(false);
  });

  test("tampered timestamp fails", () => {
    const sig = generateHMAC(secret, ts, nonce, body);
    expect(verifySignature(secret, "1700000001", nonce, body, sig)).toBe(false);
  });

  test("wrong secret fails", () => {
    const sig = generateHMAC("other", ts, nonce, body);
    expect(verifySignature(secret, ts, nonce, body, sig)).toBe(false);
  });

  test("missing signature fails", () => {
    expect(verifySignature(secret, ts, nonce, body, undefined)).toBe(false);
  });
});
