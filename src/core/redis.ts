import fs from "fs";
import Redis, { type RedisOptions, type SentinelAddress } from "ioredis";

export class RedisClient {
  public redis: Redis;
  public readonly isEnabled: boolean;

  constructor() {
    const clean = (s?: string) => s?.replace(/#.*$/, "").trim().replace(/^["']|["']$/g, "").trim();

    const {
      REDIS_ENABLED = "true",
      REDIS_URL,
      REDIS_HOST = "127.0.0.1",
      REDIS_PORT = "6379",
      REDIS_PASSWORD,
      REDIS_DB = "0",
      REDIS_KEY_PREFIX,
      REDIS_SENTINEL_NAME = "mymaster",
      REDIS_SENTINELS,
      REDIS_SENTINEL_PASSWORD,
      REDIS_NAT_MAP,
      REDIS_TLS,
      REDIS_TLS_CA,
      REDIS_TLS_CERT,
      REDIS_TLS_KEY,
      REDIS_TLS_REJECT_UNAUTHORIZED,
    } = process.env;

    const enabledVal = clean(REDIS_ENABLED);
    this.isEnabled = enabledVal !== "false" && enabledVal !== "0";

    const read = (p?: string) => (p && fs.existsSync(p) ? fs.readFileSync(p) : p);
    const tlsVal = clean(REDIS_TLS);
    const caVal = clean(REDIS_TLS_CA);
    const certVal = clean(REDIS_TLS_CERT);
    const keyVal = clean(REDIS_TLS_KEY);
    const rejectVal = clean(REDIS_TLS_REJECT_UNAUTHORIZED);

    const tls = tlsVal === "true" || caVal || certVal ? {
      rejectUnauthorized: rejectVal !== "false",
      ...(caVal && { ca: read(caVal) }),
      ...(certVal && { cert: read(certVal) }),
      ...(keyVal && { key: read(keyVal) }),
    } : undefined;

    const sentinelsStr = clean(REDIS_SENTINELS);
    const sentinels: SentinelAddress[] | undefined = sentinelsStr
      ? sentinelsStr.split(",").map((s) => {
          const [host, port] = s.trim().split(":");
          return { host, port: Number(port) || 26379 };
        })
      : undefined;

    const natMapStr = clean(REDIS_NAT_MAP);
    const natMap: Record<string, { host: string; port: number }> | undefined = natMapStr
      ? natMapStr.startsWith("{")
        ? JSON.parse(natMapStr)
        : Object.fromEntries(
            natMapStr.split(",").map((entry) => {
              const [internal, external] = entry.trim().split("=");
              const [host, port] = (external || "").split(":");
              return [internal, { host: host || "127.0.0.1", port: Number(port) || 6379 }];
            })
          )
      : undefined;

    const password = clean(REDIS_PASSWORD);
    const sentinelPassword = clean(REDIS_SENTINEL_PASSWORD);
    const prefix = clean(REDIS_KEY_PREFIX);
    const db = Number(clean(REDIS_DB) || "0");

    const opts: RedisOptions = {
      ...(!this.isEnabled && { lazyConnect: true }),
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 500)),
      sentinelRetryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 500)),
      ...(password && { password }),
      db,
      ...(prefix && { keyPrefix: prefix }),
      ...(tls && { tls }),
      ...(natMap && { natMap }),
      ...(sentinels
        ? {
            name: clean(REDIS_SENTINEL_NAME) || "mymaster",
            sentinels,
            ...(sentinelPassword && { sentinelPassword }),
          }
        : {
            host: clean(REDIS_HOST) || "127.0.0.1",
            port: Number(clean(REDIS_PORT) || "6379"),
          }),
    };

    const url = clean(REDIS_URL);
    this.redis = url ? new Redis(url, opts) : new Redis(opts);

    this.redis.on("error", () => {});
  }

  public async connect(): Promise<void> {
    if (this.isEnabled && this.redis.status === "wait") {
      try {
        await this.redis.connect();
      } catch {}
    }
  }
}

export const redis = new RedisClient();
