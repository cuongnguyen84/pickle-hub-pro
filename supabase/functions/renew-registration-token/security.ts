// Server-only 32-byte random key, supplied as 64 hex characters in Edge secrets.
// No fallback to legacy OTP hashing. Domain separation prevents IP/code reuse.
export async function renewalDigest(keyHex: string | undefined, domain: "code" | "ip", value: string): Promise<string | null> {
  if (!keyHex || !/^[0-9a-f]{64}$/i.test(keyHex)) return null;
  const keyBytes = Uint8Array.from(keyHex.match(/../g)!, part => parseInt(part, 16));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`registration-renewal:${domain}:${value}`)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

// Public gateway headers are advisory unless the platform overwrite contract is
// independently verified. Canonicalization limits cardinality/input size only.
export function canonicalRenewalIp(input: string | null): string | null {
  if (!input || input.length > 45) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(input)) {
    const octets = input.split(".").map(Number);
    return octets.every(value => value <= 255) ? octets.join(".") : null;
  }
  if (!/^[0-9a-f:.]+$/i.test(input) || !input.includes(":")) return null;
  try { return new URL(`http://[${input}]/`).hostname.toLowerCase(); } catch { return null; }
}

export async function readRenewalBody(req: Request): Promise<Record<string, unknown> | null> {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const declared = req.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 4096)) { await reader.cancel(); return null; }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel(); reject(new Error("body_timeout")); }, 3000); });
  try {
    const text = await Promise.race([(async () => {
      let size = 0; const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 4096) { await reader.cancel(); throw new Error("body_too_large"); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return new TextDecoder().decode(bytes);
    })(), deadline]);
    const body: unknown = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
