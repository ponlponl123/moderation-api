import type { ImageModerationResult, ImageRatios } from "../types";
import { configManager } from "./config";
import { cache } from "./cache";
import { logger } from "./logger";
import { hashPayload } from "../utils/image";

export class ImageModerator {
  private static classifier: any = null;
  private static rawImageClass: any = null;
  private static classifierPromise: Promise<any> | null = null;
  private static inFlight = new Map<string, Promise<ImageModerationResult>>();
  private static inferenceQueue: Promise<any> = Promise.resolve();

  public static isModelLoaded(): boolean {
    return this.classifier !== null;
  }

  private static async getClassifier() {
    if (this.classifier) return this.classifier;

    if (!this.classifierPromise) {
      this.classifierPromise = (async () => {
        const conf = configManager.get();
        const progress = logger.progress(`Model: ${conf.imageModel}`, 100);
        progress.update(15, undefined, { message: "Loading transformers runtime..." });
        const startTime = performance.now();

        const { env, pipeline, RawImage } = await import("@huggingface/transformers");
        this.rawImageClass = RawImage;
        env.useBrowserCache = false;
        if (process.env.TRANSFORMERS_CACHE) {
          env.cacheDir = process.env.TRANSFORMERS_CACHE;
        }
        progress.update(50, undefined, { message: "Initializing ONNX ViT classifier (q8)..." });

        const instance = await pipeline("image-classification", conf.imageModel, {
          dtype: "q8",
          session_options: {
            intraOpNumThreads: conf.cpuThreads,
            interOpNumThreads: conf.cpuThreads,
          },
        });
        progress.update(100, undefined, { message: "Image pipeline initialized" });

        const elapsed = (performance.now() - startTime).toFixed(1);
        logger.info(`Image model ready in ${elapsed}ms! Threads: ${conf.cpuThreads}`);
        this.classifier = instance;
        return instance;
      })();
    }
    return this.classifierPromise;
  }

  public static async moderate(buffer: Buffer): Promise<ImageModerationResult> {
    const start = performance.now();
    const conf = configManager.get();
    const emptyRatios: ImageRatios = { drawings: 0, hentai: 0, neutral: 1, porn: 0, sexy: 0 };

    if (!conf.enabled || !conf.imageEnabled) {
      return {
        flagged: false,
        score: 0,
        engine: "disabled",
        ratios: emptyRatios,
        durationMs: 0,
      };
    }

    if (!buffer || buffer.length === 0) {
      return {
        flagged: false,
        score: 0,
        engine: "none",
        ratios: emptyRatios,
        durationMs: Number((performance.now() - start).toFixed(2)),
      };
    }

    if (buffer.length > 20 * 1024 * 1024) {
      return {
        flagged: true,
        score: 1.0,
        engine: "guard",
        category: "oversized_payload",
        reason: "Image exceeds 20MB maximum moderation payload size",
        ratios: emptyRatios,
        durationMs: Number((performance.now() - start).toFixed(2)),
      };
    }

    const hash = hashPayload(buffer);
    const cacheKey = `mod:img:${hash}`;

    const inFlightPromise = this.inFlight.get(cacheKey);
    if (inFlightPromise) {
      return inFlightPromise;
    }

    const cached = await cache.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as ImageModerationResult;
        parsed.cached = true;
        parsed.durationMs = Number((performance.now() - start).toFixed(2));
        return parsed;
      } catch {}
    }

    const execPromise = (async () => {
      try {
        const classifier = await this.getClassifier();

        const progress = logger.progress("Evaluating Image", 100);
        progress.update(25, undefined, { message: "Decoding raw image blob..." });

        const RawImage = this.rawImageClass || (await import("@huggingface/transformers")).RawImage;
        const img = await RawImage.read(new Blob([buffer as any]));
        progress.update(60, undefined, { message: "Running 5-class ONNX inference..." });

        // Serialized queue: strictly 1 heavy inference at a time on potato CPU
        const rawResults = await (this.inferenceQueue = this.inferenceQueue
          .catch(() => {})
          .then(() => classifier(img, { topk: 5 })));

        progress.update(100, undefined, { message: "Image ratios computed" });

        const ratios: ImageRatios = {
          drawings: 0,
          hentai: 0,
          neutral: 0,
          porn: 0,
          sexy: 0,
        };

        if (Array.isArray(rawResults)) {
          for (const item of rawResults) {
            const label = item.label?.toLowerCase() as keyof ImageRatios;
            if (label in ratios) {
              ratios[label] = Number(Number(item.score || 0).toFixed(4));
            }
          }
        }

        const compositeNsfw = Number(
          Math.min(1.0, ratios.porn + ratios.hentai + ratios.sexy * 0.7).toFixed(4)
        );

        const isPorn = ratios.porn >= conf.pornThreshold;
        const isHentai = ratios.hentai >= conf.hentaiThreshold;
        const isSexy = ratios.sexy >= conf.sexyThreshold;
        const isComposite = compositeNsfw >= conf.imageThreshold;

        const flagged = isPorn || isHentai || isSexy || isComposite;

        let category: string | undefined;
        let reason: string | undefined;

        if (flagged) {
          if (isPorn) {
            category = "porn";
            reason = "Sexually explicit real-world or photographic content";
          } else if (isHentai) {
            category = "hentai";
            reason = "Sexually explicit illustrated or animated content";
          } else if (isSexy) {
            category = "sexy";
            reason = "Suggestive or provocative content";
          } else {
            category = "nsfw_image";
            reason = "Content exceeds overall NSFW safety threshold";
          }
        }

        const res: ImageModerationResult = {
          flagged,
          score: compositeNsfw,
          engine: "nsfw-image-detector-onnx",
          category,
          reason,
          ratios,
          durationMs: Number((performance.now() - start).toFixed(2)),
        };

        await cache.set(cacheKey, JSON.stringify(res), conf.cacheTtlSec);

        // Trigger GC hint on potato servers after image inference
        if (typeof Bun !== "undefined" && typeof Bun.gc === "function") {
          Bun.gc(false);
        }

        return res;
      } catch (err) {
        logger.error("Image moderation failed", err);
        return {
          flagged: false,
          score: 0,
          engine: "error",
          ratios: emptyRatios,
          durationMs: Number((performance.now() - start).toFixed(2)),
        };
      }
    })();

    this.inFlight.set(cacheKey, execPromise);
    try {
      return await execPromise;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }
}
