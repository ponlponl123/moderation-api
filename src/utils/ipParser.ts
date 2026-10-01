import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

export function ipFromContext(c: Context): string {
  try {
    let remote: string | undefined;
    try {
      remote = getConnInfo(c)?.remote?.address;
    } catch {}

    const ip =
      remote ??
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("true-client-ip") ??
      c.req.header("x-real-ip") ??
      c.req.header("remote-addr") ??
      "127.0.0.1";

    return ip;
  } catch {
    return "127.0.0.1";
  }
}

