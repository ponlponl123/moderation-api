import { Hono } from "hono/tiny";
import { redis } from "../core/redis";
import { TextModerator } from "../core/textModerator";
import { ImageModerator } from "../core/imageModerator";

export const healthRouter = new Hono();

healthRouter.get("/", (c) => {
  const mem = process.memoryUsage();
  return c.json({
    status: "ok",
    uptimeSec: Math.floor(process.uptime()),
    modelsLoaded: {
      text: TextModerator.isModelLoaded(),
      image: ImageModerator.isModelLoaded(),
    },
    redis: {
      enabled: redis.isEnabled,
      status: redis.redis.status,
    },
    memory: {
      rssMb: Number((mem.rss / 1024 / 1024).toFixed(2)),
      heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
      heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
    },
  });
});

export default healthRouter;
