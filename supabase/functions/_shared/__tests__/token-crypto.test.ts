import { describe, it, expect } from "vitest";
import {
  KEY_VERSION,
  importTokenKeyFromBase64,
  isEncrypted,
  encryptToken,
  decryptToken,
  buildTokenAAD,
} from "../token-crypto";

// Deterministic 32-byte test key (NOT a real key). base64 of 0x00..0x1f.
const TEST_KEY_B64 = btoa(
  String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)),
);
const AAD = "dupr_user_tokens.access_token";

describe("token-crypto — AES-256-GCM envelope", () => {
  it("round-trips a token (encrypt → decrypt)", async () => {
    const key = await importTokenKeyFromBase64(TEST_KEY_B64);
    const secret = "dupr_access_token_abc123";
    const enc = await encryptToken(secret, key, AAD);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc.startsWith(`enc:${KEY_VERSION}:`)).toBe(true);
    expect(enc).not.toContain(secret); // plaintext not present in ciphertext
    expect(await decryptToken(enc, key, AAD)).toBe(secret);
  });

  it("produces a distinct ciphertext each time (random nonce)", async () => {
    const key = await importTokenKeyFromBase64(TEST_KEY_B64);
    const a = await encryptToken("same", key, AAD);
    const b = await encryptToken("same", key, AAD);
    expect(a).not.toBe(b);
    expect(await decryptToken(a, key, AAD)).toBe("same");
    expect(await decryptToken(b, key, AAD)).toBe("same");
  });

  it("DUAL-READ: returns a plaintext (non-enc) value unchanged", async () => {
    const key = await importTokenKeyFromBase64(TEST_KEY_B64);
    expect(await decryptToken("legacy_plaintext_token", key, AAD)).toBe(
      "legacy_plaintext_token",
    );
  });

  it("fails to decrypt when AAD context differs (field binding)", async () => {
    const key = await importTokenKeyFromBase64(TEST_KEY_B64);
    const enc = await encryptToken("tok", key, "dupr_user_tokens.access_token");
    await expect(
      decryptToken(enc, key, "dupr_user_tokens.refresh_token"),
    ).rejects.toThrow();
  });

  it("fails to decrypt with the wrong key", async () => {
    const key1 = await importTokenKeyFromBase64(TEST_KEY_B64);
    const otherKeyB64 = btoa(String.fromCharCode(...Array.from({ length: 32 }, () => 0xff)));
    const key2 = await importTokenKeyFromBase64(otherKeyB64);
    const enc = await encryptToken("tok", key1, AAD);
    await expect(decryptToken(enc, key2, AAD)).rejects.toThrow();
  });

  it("rejects a key that is not 32 bytes", async () => {
    await expect(importTokenKeyFromBase64(btoa("short"))).rejects.toThrow(/32 bytes/);
  });

  it("throws on a malformed enc: value", async () => {
    const key = await importTokenKeyFromBase64(TEST_KEY_B64);
    await expect(decryptToken("enc:v1:onlytwo", key, AAD)).rejects.toThrow(/Malformed/);
  });

  it("throws on an unknown key version", async () => {
    const key = await importTokenKeyFromBase64(TEST_KEY_B64);
    await expect(decryptToken("enc:v9:aaaa:bbbb", key, AAD)).rejects.toThrow(/version/);
  });
});

describe("buildTokenAAD — environment + column + userId binding", () => {
  it("produces a canonical, fully-bound AAD string", () => {
    expect(
      buildTokenAAD({ environment: "prod", column: "access_token", userId: "u-123" }),
    ).toBe("v1:prod:dupr_user_tokens.access_token:u-123");
  });

  it("requires environment and userId", () => {
    expect(() => buildTokenAAD({ environment: "", column: "access_token", userId: "u-1" })).toThrow();
    expect(() => buildTokenAAD({ environment: "prod", column: "access_token", userId: "" })).toThrow();
  });

  it("row-swap is rejected: ciphertext for user A cannot decrypt as user B", async () => {
    const key = await importTokenKeyFromBase64(TEST_KEY_B64);
    const aadA = buildTokenAAD({ environment: "prod", column: "access_token", userId: "userA" });
    const aadB = buildTokenAAD({ environment: "prod", column: "access_token", userId: "userB" });
    const enc = await encryptToken("tokA", key, aadA);
    expect(await decryptToken(enc, key, aadA)).toBe("tokA");
    await expect(decryptToken(enc, key, aadB)).rejects.toThrow();
  });

  it("environment-swap is rejected: preview ciphertext cannot decrypt as prod", async () => {
    const key = await importTokenKeyFromBase64(TEST_KEY_B64);
    const aadPreview = buildTokenAAD({ environment: "preview", column: "refresh_token", userId: "u-1" });
    const aadProd = buildTokenAAD({ environment: "prod", column: "refresh_token", userId: "u-1" });
    const enc = await encryptToken("tok", key, aadPreview);
    await expect(decryptToken(enc, key, aadProd)).rejects.toThrow();
  });
});
