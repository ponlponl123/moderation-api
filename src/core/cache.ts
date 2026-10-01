import { redis } from "./redis";
import { logger } from "./logger";

interface CacheEntry {
  val: string;
  exp: number;
}

export class Cache {
  private mem = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly defaultTtl: number;

  constructor(maxSize = 10_000, defaultTtl = 604_800) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  private isRedisActive(): boolean {
    return redis.isEnabled && redis.redis.status === "ready";
  }

  public async get(key: string): Promise<string | null> {
    if (this.isRedisActive()) {
      try {
        const res = await redis.redis.get(key);
        if (res !== null) {
          logger.cache("HIT", key, "redis");
          return res;
        }
      } catch {}
    }

    const entry = this.mem.get(key);
    if (!entry) {
      logger.cache("MISS", key);
      return null;
    }

    if (Date.now() > entry.exp) {
      this.mem.delete(key);
      logger.cache("MISS", key, "expired");
      return null;
    }

    this.mem.delete(key);
    this.mem.set(key, entry);
    logger.cache("HIT", key, "memory");
    return entry.val;
  }

  public async set(key: string, val: string, ttlSeconds = this.defaultTtl): Promise<void> {
    if (this.isRedisActive()) {
      try {
        await redis.redis.set(key, val, "EX", ttlSeconds);
        logger.cache("SET", key, `redis ${ttlSeconds}s`);
        return;
      } catch {}
    }

    if (this.mem.size >= this.maxSize) {
      const oldest = this.mem.keys().next().value;
      if (oldest) this.mem.delete(oldest);
    }

    this.mem.set(key, {
      val,
      exp: Date.now() + ttlSeconds * 1000,
    });
    logger.cache("SET", key, `mem ${ttlSeconds}s`);
  }

  public async del(key: string): Promise<void> {
    if (this.isRedisActive()) {
      try {
        await redis.redis.del(key);
      } catch {}
    }
    this.mem.delete(key);
  }

  public clear(): void {
    this.mem.clear();
  }
}

export const cache = new Cache();
