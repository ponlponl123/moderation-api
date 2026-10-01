import { describe, expect, it } from "bun:test";
import app from "../src/index";
import { configManager } from "../src/core/config";
import { logger } from "../src/core/logger";
import { TextModerator } from "../src/core/textModerator";
import { ImageModerator } from "../src/core/imageModerator";
import { Moderator } from "../src/core/moderator";
import { SAMPLE_1X1_PNG_BASE64 } from "../src/consts";

describe("Moderation API Test Suite", () => {
  describe("Configuration & Health", () => {
    it("should load configuration properly", () => {
      const conf = configManager.get();
      expect(conf.enabled).toBe(true);
      expect(conf.textEnabled).toBe(true);
      expect(conf.imageEnabled).toBe(true);
      expect(conf.cpuThreads).toBeGreaterThanOrEqual(1);
    });

    it("should render ts-better-console status and warning cards cleanly", () => {
      expect(() => configManager.printStatusCard()).not.toThrow();
      expect(() => configManager.printWarningCard()).not.toThrow();
      expect(() => logger.card("Test Status")).not.toThrow();
    });

    it("should respond to GET / with service specifications", async () => {
      const res = await app.fetch(new Request("http://localhost/"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.service).toBe("moderation-api");
      expect(json.specs.imageClasses).toContain("hentai");
      expect(json.specs.imageClasses).toContain("porn");
      expect(json.specs.imageClasses).toContain("drawings");
      expect(json.specs.imageClasses).toContain("sexy");
      expect(json.specs.imageClasses).toContain("neutral");
    });

    it("should respond to GET /health", async () => {
      const res = await app.fetch(new Request("http://localhost/health"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.memory.rssMb).toBeGreaterThan(0);
    });
  });

  describe("Text Moderation Engine", () => {
    it("should pass benign English and Thai text", async () => {
      const resEn = await TextModerator.moderate("Welcome to my livestream! Hope you have a wonderful day.");
      expect(resEn.flagged).toBe(false);
      expect(resEn.ratios.neutral).toBeGreaterThan(0.5);

      const resTh = await TextModerator.moderate("สวัสดีครับทุกคน วันนี้เราจะมาเขียนโค้ดกัน");
      expect(resTh.flagged).toBe(false);
    });

    it("should flag explicit toxic English text via Tier 0 lexicon", async () => {
      const res = await TextModerator.moderate("fuck you idiot bitch");
      expect(res.flagged).toBe(true);
      expect(res.engine).toBe("lexicon");
      expect(res.ratios.toxic).toBe(1.0);
    });

    it("should flag explicit toxic Thai text via Tier 0 lexicon", async () => {
      const res = await TextModerator.moderate("ไอ้เหี้ย มึงไปตายซะ ควย");
      expect(res.flagged).toBe(true);
      expect(res.engine).toBe("lexicon");
    });

    it("should flag sexually explicit English and Thai text", async () => {
      const resEn = await TextModerator.moderate("nude naked pussy boobs penis erotic orgasm");
      expect(resEn.flagged).toBe(true);
      expect(resEn.category).toBe("nsfw_content");

      const resTh = await TextModerator.moderate("หีอมชมพู ควยใหญ่ เงี่ยนมาก");
      expect(resTh.flagged).toBe(true);
    });

    it("should serve repeat text queries from cache", async () => {
      const phrase = "This is a unique test phrase for caching verification.";
      const res1 = await TextModerator.moderate(phrase);
      expect(res1.cached).toBeFalsy();

      const res2 = await TextModerator.moderate(phrase);
      expect(res2.cached).toBe(true);
      expect(res2.durationMs).toBeLessThan(15);
    });

    it("should handle empty or whitespace text gracefully", async () => {
      const res = await TextModerator.moderate("   ");
      expect(res.flagged).toBe(false);
      expect(res.score).toBe(0);
    });
  });

  describe("Image Moderation Engine", () => {
    it("should handle empty buffer without crashing", async () => {
      const res = await ImageModerator.moderate(Buffer.alloc(0));
      expect(res.flagged).toBe(false);
      expect(res.score).toBe(0);
    });

    const samplePng = Buffer.from(SAMPLE_1X1_PNG_BASE64, "base64");

    it("should classify neutral image and return 5-class ratios", async () => {
      const res = await ImageModerator.moderate(samplePng);
      expect(res.engine).toBe("nsfw-image-detector-onnx");
      expect(res.ratios).toBeDefined();
      expect(res.ratios.neutral).toBeGreaterThan(0.4);
      expect(res.ratios.porn).toBeLessThan(0.3);
      expect(res.ratios.hentai).toBeLessThan(0.3);
      expect(res.flagged).toBe(false);
    });

    it("should serve repeat image queries from cache", async () => {
      const res1 = await ImageModerator.moderate(samplePng);
      const res2 = await ImageModerator.moderate(samplePng);
      expect(res2.cached).toBe(true);
      expect(res2.durationMs).toBeLessThan(15);
    });
  });

  describe("REST API Endpoints", () => {
    it("should moderate text via POST /v1/moderate/text", async () => {
      const req = new Request("http://localhost/v1/moderate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello friendly world!" }),
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.flagged).toBe(false);
      expect(json.ratios.neutral).toBeGreaterThan(0.5);
    });

    it("should moderate via unified POST /v1/moderate", async () => {
      const req = new Request("http://localhost/v1/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Super cool harmless sentence." }),
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.flagged).toBe(false);
      expect(json.text).toBeDefined();
    });
  });
});
