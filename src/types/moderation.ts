export interface ImageRatios {
  drawings: number;
  hentai: number;
  neutral: number;
  porn: number;
  sexy: number;
}

export interface TextRatios {
  nsfw: number;
  toxic: number;
  violence: number;
  neutral: number;
}

export interface ImageModerationResult {
  flagged: boolean;
  score: number;
  engine: string;
  category?: string;
  reason?: string;
  ratios: ImageRatios;
  cached?: boolean;
  durationMs?: number;
}

export interface TextModerationResult {
  flagged: boolean;
  score: number;
  engine: string;
  category?: string;
  reason?: string;
  ratios: TextRatios;
  cached?: boolean;
  durationMs?: number;
}

export interface UnifiedModerationRequest {
  text?: string;
  image?: string;
  imageUrl?: string;
}

export interface UnifiedModerationResponse {
  flagged: boolean;
  text?: TextModerationResult;
  image?: ImageModerationResult;
  durationMs: number;
}
