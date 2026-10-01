import { Hono } from "hono/tiny";

import { MODERATION_DISCLAIMER } from "../consts/moderation";

export const rootRouter = new Hono();

rootRouter.get("/", (c) => {
  return c.json({
    service: "moderation-api",
    version: "1.0.0",
    disclaimer: MODERATION_DISCLAIMER,
    description: "Ultra-lightweight, hyper-performance text and image moderation service",
    endpoints: {
      "POST /v1/moderate": "Unified moderation for text and image",
      "POST /v1/moderate/text": "Multilingual text moderation with toxicity and NSFW ratios",
      "POST /v1/moderate/image": "Image moderation with 5-class ratios (drawings, hentai, neutral, porn, sexy)",
      "GET /health": "System health and resource usage",
    },
    specs: {
      imageClasses: ["drawings", "hentai", "neutral", "porn", "sexy"],
      textClasses: ["nsfw", "toxic", "violence", "neutral"],
      potatoOptimizations: [
        "Lazy ML model loading",
        "Strict 1-thread ONNX execution",
        "Quantized q8 / int8 weights",
        "Tier 0 regex fast-path (0ms)",
        "Two-tier LRU memory + Redis SHA-256 caching",
      ],
    },
  });
});

export default rootRouter;
