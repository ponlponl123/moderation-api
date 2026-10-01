import type { ModerationConfig } from "../types";
import { DEFAULT_MODERATION_CONFIG } from "../consts";
import betterConsole, { Card, rgb, tsflag, s } from "ts-better-console";

export class ConfigManager {
  private config: ModerationConfig;

  constructor() {
    const clean = (item?: string) => item?.replace(/#.*$/, "").trim().replace(/^["']|["']$/g, "").trim();

    this.config = {
      port: Number(clean(process.env.PORT) || DEFAULT_MODERATION_CONFIG.port),
      apiKey: clean(process.env.API_KEY),
      enabled: clean(process.env.MODERATION_ENABLED) !== undefined
        ? clean(process.env.MODERATION_ENABLED) !== "false"
        : DEFAULT_MODERATION_CONFIG.enabled,
      textEnabled: clean(process.env.MODERATION_TEXT_ENABLED) !== undefined
        ? clean(process.env.MODERATION_TEXT_ENABLED) !== "false"
        : DEFAULT_MODERATION_CONFIG.textEnabled,
      imageEnabled: clean(process.env.MODERATION_IMAGE_ENABLED) !== undefined
        ? clean(process.env.MODERATION_IMAGE_ENABLED) !== "false"
        : DEFAULT_MODERATION_CONFIG.imageEnabled,
      cpuThreads: Math.max(1, Number(clean(process.env.MODERATION_CPU_THREADS) || DEFAULT_MODERATION_CONFIG.cpuThreads)),
      textThreshold: Number(clean(process.env.MODERATION_TEXT_THRESHOLD) || DEFAULT_MODERATION_CONFIG.textThreshold),
      imageThreshold: Number(clean(process.env.MODERATION_IMAGE_THRESHOLD) || DEFAULT_MODERATION_CONFIG.imageThreshold),
      pornThreshold: Number(clean(process.env.MODERATION_PORN_THRESHOLD) || DEFAULT_MODERATION_CONFIG.pornThreshold),
      hentaiThreshold: Number(clean(process.env.MODERATION_HENTAI_THRESHOLD) || DEFAULT_MODERATION_CONFIG.hentaiThreshold),
      sexyThreshold: Number(clean(process.env.MODERATION_SEXY_THRESHOLD) || DEFAULT_MODERATION_CONFIG.sexyThreshold),
      toxicThreshold: Number(clean(process.env.MODERATION_TOXIC_THRESHOLD) || DEFAULT_MODERATION_CONFIG.toxicThreshold),
      violenceThreshold: Number(clean(process.env.MODERATION_VIOLENCE_THRESHOLD) || DEFAULT_MODERATION_CONFIG.violenceThreshold),
      cacheTtlSec: Number(clean(process.env.MODERATION_CACHE_TTL_SEC) || DEFAULT_MODERATION_CONFIG.cacheTtlSec),
      imageModel: clean(process.env.IMAGE_MODEL) || DEFAULT_MODERATION_CONFIG.imageModel,
      textModel: clean(process.env.TEXT_MODEL) || DEFAULT_MODERATION_CONFIG.textModel,
    };
  }

  public get(): ModerationConfig {
    return this.config;
  }

  public printStatusCard(): void {
    const conf = this.config;
    const lines = [
      s("Content Moderation Microservice", { styles: ["bold"] }),
      "",
      `• Global Status    : ${conf.enabled ? s("ENABLED", { color: "green" }) : s("DISABLED", { color: "red" })}`,
      `• Text Moderation  : ${conf.textEnabled ? s("ACTIVE", { color: "cyan" }) : s("DISABLED", { color: "gray" })} (thresh: ${conf.textThreshold})`,
      `• Image Moderation : ${conf.imageEnabled ? s("ACTIVE (5-class)", { color: "cyan" }) : s("DISABLED", { color: "gray" })} (thresh: ${conf.imageThreshold})`,
      `• CPU Threads      : ${conf.cpuThreads} (strict low-resource limit)`,
      `• Quantization     : q8 (int8 ONNX)`,
      `• Cache TTL        : ${conf.cacheTtlSec}s (SHA-256)`,
    ];

    new Card(lines.join("\n"), undefined, {
      border: {
        style: { color: conf.enabled ? rgb(59, 130, 246) : rgb(245, 158, 11) },
        symbols: { style: "round" },
      },
    })
      .render()
      .split("\n")
      .forEach((line) => betterConsole.log(tsflag("info", true, line)));
  }

  public printWarningCard(): void {
    const conf = this.config;
    if (conf.enabled && conf.textEnabled && conf.imageEnabled) return;

    const lines = [
      s("⚠ Moderation Partial/Bypass Notice", { color: "yellow", styles: ["bold"] }),
      "",
      `• Global Enabled   : ${conf.enabled}`,
      `• Text Enabled     : ${conf.textEnabled}`,
      `• Image Enabled    : ${conf.imageEnabled}`,
    ];

    new Card(lines.join("\n"), undefined, {
      border: {
        style: { color: rgb(245, 158, 11) },
        symbols: { style: "round" },
      },
    })
      .render()
      .split("\n")
      .forEach((line) => betterConsole.log(tsflag("warn", true, line)));
  }
}

export const configManager = new ConfigManager();
