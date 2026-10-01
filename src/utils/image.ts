import crypto from "crypto";

export function hashPayload(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function resolveImageBuffer(
  input: string | ArrayBuffer | Uint8Array | Buffer,
  maxBytes = 20 * 1024 * 1024
): Promise<Buffer | null> {
  if (!input) return null;

  if (Buffer.isBuffer(input)) {
    return input.length <= maxBytes ? input : null;
  }

  if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
    const buf = Buffer.from(input as any);
    return buf.length <= maxBytes ? buf : null;
  }

  if (typeof input === "string") {
    const str = input.trim();
    if (!str) return null;

    if (str.startsWith("http://") || str.startsWith("https://")) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(str, {
          signal: controller.signal,
          headers: { "User-Agent": "moderation-api/1.0" },
        });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > maxBytes) return null;
        return Buffer.from(arrayBuf);
      } catch {
        return null;
      }
    }

    const base64Index = str.indexOf(";base64,");
    const cleanBase64 = base64Index !== -1 ? str.slice(base64Index + 8) : str;
    try {
      const buf = Buffer.from(cleanBase64, "base64");
      return buf.length > 0 && buf.length <= maxBytes ? buf : null;
    } catch {
      return null;
    }
  }

  return null;
}
