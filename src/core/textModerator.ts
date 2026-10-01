import type { TextModerationResult, TextRatios } from "../types";
import { configManager } from "./config";
import { cache } from "./cache";
import { logger } from "./logger";
import {
  normalizeText,
  splitChunks,
  checkTier0Lexicon,
} from "../utils/text";
import {
  TOXIC_ANCHOR_TEXT,
  NSFW_ANCHOR_TEXT,
  VIOLENCE_ANCHOR_TEXT,
} from "../consts";
import { hashPayload } from "../utils/image";

export class TextModerator {
  private static extractor: any = null;
  private static cosSimFn: any = null;
  private static toxicAnchor: Float32Array | null = null;
  private static nsfwAnchor: Float32Array | null = null;
  private static violenceAnchor: Float32Array | null = null;
  private static extractorPromise: Promise<any> | null = null;
  private static inFlight = new Map<string, Promise<TextModerationResult>>();
  private static inferenceQueue: Promise<any> = Promise.resolve();
  private static anchorsPromise: Promise<{
    toxic: Float32Array;
    nsfw: Float32Array;
    violence: Float32Array;
  }> | null = null;

  public static isModelLoaded(): boolean {
    return this.extractor !== null;
  }

  private static async getExtractor() {
    if (this.extractor) return this.extractor;

    if (!this.extractorPromise) {
      this.extractorPromise = (async () => {
        const conf = configManager.get();
        const progress = logger.progress(`Model: ${conf.textModel}`, 100);
        progress.update(15, undefined, { message: "Loading transformers runtime..." });
        const startTime = performance.now();

        const { env, pipeline, cos_sim } = await import("@huggingface/transformers");
        this.cosSimFn = cos_sim;
        env.useBrowserCache = false;
        if (process.env.TRANSFORMERS_CACHE) {
          env.cacheDir = process.env.TRANSFORMERS_CACHE;
        }
        progress.update(50, undefined, { message: "Initializing ONNX session (q8)..." });

        const instance = await pipeline("feature-extraction", conf.textModel, {
          dtype: "q8",
          session_options: {
            intraOpNumThreads: conf.cpuThreads,
            interOpNumThreads: conf.cpuThreads,
          },
        });
        progress.update(100, undefined, { message: "Text pipeline initialized" });

        const elapsed = (performance.now() - startTime).toFixed(1);
        logger.info(`Text model ready in ${elapsed}ms! Threads: ${conf.cpuThreads}`);
        this.extractor = instance;
        return instance;
      })();
    }
    return this.extractorPromise;
  }

  private static async getAnchors(extractor: any) {
    if (this.toxicAnchor && this.nsfwAnchor && this.violenceAnchor) {
      return {
        toxic: this.toxicAnchor,
        nsfw: this.nsfwAnchor,
        violence: this.violenceAnchor,
      };
    }

    if (!this.anchorsPromise) {
      this.anchorsPromise = (async () => {
        const toxicOut = await extractor(TOXIC_ANCHOR_TEXT, { pooling: "mean", normalize: true });
        this.toxicAnchor = new Float32Array(toxicOut.data);

        const nsfwOut = await extractor(NSFW_ANCHOR_TEXT, { pooling: "mean", normalize: true });
        this.nsfwAnchor = new Float32Array(nsfwOut.data);

        const violenceOut = await extractor(VIOLENCE_ANCHOR_TEXT, { pooling: "mean", normalize: true });
        this.violenceAnchor = new Float32Array(violenceOut.data);

        return {
          toxic: this.toxicAnchor,
          nsfw: this.nsfwAnchor,
          violence: this.violenceAnchor,
        };
      })();
    }
    return this.anchorsPromise;
  }

  public static async moderate(rawText: string): Promise<TextModerationResult> {
    const start = performance.now();
    const conf = configManager.get();
    const emptyRatios: TextRatios = { nsfw: 0, toxic: 0, violence: 0, neutral: 1 };

    if (!conf.enabled || !conf.textEnabled) {
      return {
        flagged: false,
        score: 0,
        engine: "disabled",
        ratios: emptyRatios,
        durationMs: 0,
      };
    }

    const trimmed = (rawText || "").slice(0, 4000).trim();
    if (!trimmed) {
      return {
        flagged: false,
        score: 0,
        engine: "none",
        ratios: emptyRatios,
        durationMs: Number((performance.now() - start).toFixed(2)),
      };
    }

    const hash = hashPayload(trimmed);
    const cacheKey = `mod:txt:${hash}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TextModerationResult;
        parsed.cached = true;
        parsed.durationMs = Number((performance.now() - start).toFixed(2));
        return parsed;
      } catch { }
    }

    // Tier 0: Regex Lexicon Fast Path (<0.1ms, 0 CPU ML overhead)
    const tier0 = checkTier0Lexicon(trimmed);
    if (tier0.matched && tier0.ratios) {
      const res: TextModerationResult = {
        flagged: true,
        score: 1.0,
        engine: "lexicon",
        category: tier0.category,
        reason: tier0.reason,
        ratios: tier0.ratios,
        durationMs: Number((performance.now() - start).toFixed(2)),
      };
      await cache.set(cacheKey, JSON.stringify(res), conf.cacheTtlSec);
      return res;
    }

    const inFlightPromise = this.inFlight.get(cacheKey);
    if (inFlightPromise) {
      return inFlightPromise;
    }

    const execPromise = (async () => {
      // Tier 1: Multilingual ONNX Semantic Vector Evaluation
      try {
        const extractor = await this.getExtractor();
        const anchors = await this.getAnchors(extractor);

        const progress = logger.progress("Evaluating Text", 100);
        progress.update(25, undefined, { message: "Normalizing text..." });

        const normalized = normalizeText(trimmed);
        const chunks = splitChunks(normalized);
        progress.update(50, undefined, { message: `Running batched ONNX inference (${chunks.length} clauses)...` });

        const cos_sim = this.cosSimFn || (await import("@huggingface/transformers")).cos_sim;

        // Single-pass batched inference + serialized execution queue
        const embs = await (this.inferenceQueue = this.inferenceQueue
          .catch(() => {})
          .then(() => extractor(chunks, { pooling: "mean", normalize: true })));

        const dim = 384;
        let maxNsfw = 0;
        let maxToxic = 0;
        let maxViolence = 0;

        for (let i = 0; i < chunks.length; i++) {
          const chunkData = chunks.length === 1 ? embs.data : embs.data.subarray(i * dim, (i + 1) * dim);
          const toxicScore = Math.max(0, (cos_sim as any)(chunkData, anchors.toxic));
          const nsfwScore = Math.max(0, (cos_sim as any)(chunkData, anchors.nsfw));
          const violenceScore = Math.max(0, (cos_sim as any)(chunkData, anchors.violence));

          if (toxicScore > maxToxic) maxToxic = toxicScore;
          if (nsfwScore > maxNsfw) maxNsfw = nsfwScore;
          if (violenceScore > maxViolence) maxViolence = violenceScore;
        }
        progress.update(100, undefined, { message: "Text ratios computed" });

        const topNonNeutral = Math.max(maxNsfw, maxToxic, maxViolence);
        const neutralScore = Math.max(0, 1 - topNonNeutral);

        const ratios: TextRatios = {
          nsfw: Number(maxNsfw.toFixed(4)),
          toxic: Number(maxToxic.toFixed(4)),
          violence: Number(maxViolence.toFixed(4)),
          neutral: Number(neutralScore.toFixed(4)),
        };

        const flagged =
          maxNsfw >= conf.textThreshold ||
          maxToxic >= conf.toxicThreshold ||
          maxViolence >= conf.violenceThreshold;

        let category: string | undefined;
        let reason: string | undefined;

        if (flagged) {
          if (topNonNeutral === maxNsfw) {
            category = "nsfw_content";
            reason = "Sexually explicit content detected via semantic vector";
          } else if (topNonNeutral === maxViolence) {
            category = "graphic_violence";
            reason = "Graphic violence or threat detected via semantic vector";
          } else {
            category = "toxic_conduct";
            reason = "Toxic conduct or offensive language detected via semantic vector";
          }
        }

        const res: TextModerationResult = {
          flagged,
          score: Number(topNonNeutral.toFixed(4)),
          engine: "multilingual-minilm",
          category,
          reason,
          ratios,
          durationMs: Number((performance.now() - start).toFixed(2)),
        };

        await cache.set(cacheKey, JSON.stringify(res), conf.cacheTtlSec);
        return res;
      } catch (err) {
        logger.error("Text moderation failed", err);
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
