import { describe, it, expect } from "vitest";
import {
  KEY_VERSION,
  importTokenKeyFromBase64,
  makeKeyring,
  isEncrypted,
  encryptToken,
  decryptToken,
  buildTokenAAD,
  projectRefFromSupabaseUrl,
  buildKeyring,
  tokenVersion,
  decryptField,
  encryptFieldOptional,
  encryptFieldRequired,
  type TokenKeyring,
} from "../token-crypto";

// Deterministic 32-byte test keys (NOT real keys).
const keyB64 = (fill: number) =>
  btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => (fill === -1 ? i : fill))));
const AAD = buildTokenAAD({ projectRef: "ajvlcamxemgbxduhiqrl", column: "access_token", userId: "u-1" });

async function ring(version = "v1", fill = -1): Promise<TokenKeyring> {
  return makeKeyring(version, await importTokenKeyFromBase64(keyB64(fill)));
}

describe("token-crypto — AES-256-GCM envelope", () => {
  it("round-trips a token (encrypt → decrypt)", async () => {
    const kr = await ring();
    const secret = "dupr_access_token_abc123";
    const enc = await encryptToken(secret, kr, AAD);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc.startsWith(`enc:${KEY_VERSION}:`)).toBe(true);
    expect(enc).not.toContain(secret);
    expect(await decryptToken(enc, kr, AAD)).toBe(secret);
  });

  it("produces a distinct ciphertext each time (random nonce)", async () => {
    const kr = await ring();
    const a = await encryptToken("same", kr, AAD);
    const b = await encryptToken("same", kr, AAD);
    expect(a).not.toBe(b);
    expect(await decryptToken(a, kr, AAD)).toBe("same");
  });

  it("fails to decrypt with the wrong key", async () => {
    const enc = await encryptToken("tok", await ring("v1", 0x01), AAD);
    await expect(decryptToken(enc, await ring("v1", 0xff), AAD)).rejects.toThrow();
  });

  it("throws on a malformed enc: value", async () => {
    await expect(decryptToken("enc:v1:onlytwo", await ring(), AAD)).rejects.toThrow(/Malformed/);
  });

  it("rejects a key that is not 32 bytes", async () => {
    await expect(importTokenKeyFromBase64(btoa("short"))).rejects.toThrow(/32 bytes/);
  });
});

describe("dual-read — plaintext handling is explicit (P2)", () => {
  it("REJECTS a plaintext value by default", async () => {
    await expect(decryptToken("legacy_plaintext", await ring(), AAD)).rejects.toThrow(/plaintext token rejected/);
  });

  it("passes plaintext through ONLY when allowPlaintext is set", async () => {
    expect(await decryptToken("legacy_plaintext", await ring(), AAD, { allowPlaintext: true })).toBe(
      "legacy_plaintext",
    );
  });

  it("still decrypts ciphertext normally with allowPlaintext set", async () => {
    const kr = await ring();
    const enc = await encryptToken("tok", kr, AAD);
    expect(await decryptToken(enc, kr, AAD, { allowPlaintext: true })).toBe("tok");
  });
});

describe("rotation — keyring selects key by embedded version (P2)", () => {
  it("v1 ciphertext still decrypts after activeVersion moves to v2", async () => {
    const v1 = await importTokenKeyFromBase64(keyB64(0x11));
    const v2 = await importTokenKeyFromBase64(keyB64(0x22));
    const writeV1: TokenKeyring = makeKeyring("v1", v1);
    const enc = await encryptToken("tok", writeV1, AAD);
    expect(enc.startsWith("enc:v1:")).toBe(true);

    // Rotated keyring: active=v2 but v1 retained for decrypt.
    const rotated: TokenKeyring = { activeVersion: "v2", keys: new Map([["v1", v1], ["v2", v2]]) };
    expect(await decryptToken(enc, rotated, AAD)).toBe("tok");
    // New writes now use v2.
    const enc2 = await encryptToken("tok2", rotated, AAD);
    expect(enc2.startsWith("enc:v2:")).toBe(true);
  });

  it("throws when the keyring has no key for the token's version", async () => {
    const enc = await encryptToken("tok", await ring("v1", 0x11), AAD);
    const onlyV2 = makeKeyring("v2", await importTokenKeyFromBase64(keyB64(0x22)));
    await expect(decryptToken(enc, onlyV2, AAD)).rejects.toThrow(/no key in keyring/);
  });

  it("encrypt throws if active version has no key", async () => {
    const broken: TokenKeyring = { activeVersion: "v9", keys: new Map() };
    await expect(encryptToken("x", broken, AAD)).rejects.toThrow(/no key for active version/);
  });
});

describe("AAD binding — projectRef + column + userId", () => {
  it("derives the immutable project ref from SUPABASE_URL", () => {
    expect(projectRefFromSupabaseUrl("https://ajvlcamxemgbxduhiqrl.supabase.co")).toBe(
      "ajvlcamxemgbxduhiqrl",
    );
    expect(() => projectRefFromSupabaseUrl("not-a-url")).toThrow();
  });

  it("builds a canonical, fully-bound AAD", () => {
    expect(buildTokenAAD({ projectRef: "ref1", column: "access_token", userId: "u-9" })).toBe(
      "v1:ref1:dupr_user_tokens.access_token:u-9",
    );
  });

  it("requires projectRef and userId", () => {
    expect(() => buildTokenAAD({ projectRef: "", column: "access_token", userId: "u" })).toThrow();
    expect(() => buildTokenAAD({ projectRef: "r", column: "access_token", userId: "" })).toThrow();
  });

  it("row-swap rejected: user A ciphertext cannot decrypt as user B", async () => {
    const kr = await ring();
    const aadA = buildTokenAAD({ projectRef: "r", column: "access_token", userId: "A" });
    const aadB = buildTokenAAD({ projectRef: "r", column: "access_token", userId: "B" });
    const enc = await encryptToken("tokA", kr, aadA);
    await expect(decryptToken(enc, kr, aadB)).rejects.toThrow();
  });

  it("cross-env rejected: preview ciphertext cannot decrypt as prod", async () => {
    const kr = await ring();
    const aadPreview = buildTokenAAD({ projectRef: "preview-ref", column: "refresh_token", userId: "u" });
    const aadProd = buildTokenAAD({ projectRef: "prod-ref", column: "refresh_token", userId: "u" });
    const enc = await encryptToken("tok", kr, aadPreview);
    await expect(decryptToken(enc, kr, aadProd)).rejects.toThrow();
  });
});

describe("buildKeyring — from secrets (P2.5)", () => {
  it("returns null when neither version is present", async () => {
    expect(await buildKeyring(undefined, undefined)).toBeNull();
    expect(await buildKeyring("", "")).toBeNull();
  });

  it("v1 only → activeVersion v1", async () => {
    const kr = await buildKeyring(keyB64(0x11));
    expect(kr?.activeVersion).toBe("v1");
    expect(kr?.keys.has("v1")).toBe(true);
  });

  it("v1 + v2 → activeVersion v2, both keys retained", async () => {
    const kr = await buildKeyring(keyB64(0x11), keyB64(0x22));
    expect(kr?.activeVersion).toBe("v2");
    expect([...(kr?.keys.keys() ?? [])].sort()).toEqual(["v1", "v2"]);
  });

  it("tokenVersion reads the embedded version / null for plaintext", async () => {
    const enc = await encryptToken("t", await ring(), AAD);
    expect(tokenVersion(enc)).toBe("v1");
    expect(tokenVersion("plaintext")).toBeNull();
  });
});

describe("field policy — no-key handling is fail-safe (P1)", () => {
  it("no key + plaintext → passthrough", async () => {
    expect(await decryptField("legacy_plain", null, AAD)).toBe("legacy_plain");
  });

  it("no key + CIPHERTEXT → throws (never leak enc:… downstream) [P1.1]", async () => {
    const enc = await encryptToken("tok", await ring(), AAD);
    await expect(decryptField(enc, null, AAD)).rejects.toThrow(/token_key_not_configured/);
  });

  it("encryptFieldOptional no-ops without a key", async () => {
    expect(await encryptFieldOptional("plain", null, AAD)).toBe("plain");
  });

  it("encryptFieldRequired is fail-closed without a key [P1.3]", async () => {
    await expect(encryptFieldRequired("plain", null, AAD)).rejects.toThrow(/token_key_not_configured/);
  });

  it("encryptFieldRequired yields ciphertext with a key", async () => {
    const out = await encryptFieldRequired("plain", await ring(), AAD);
    expect(isEncrypted(out)).toBe(true);
  });
});
