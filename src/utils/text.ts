import type { TextRatios } from "../types";
import {
  ADULT_PROMOTION_PATTERNS,
  VIOLENCE_GORE_PATTERNS,
  HATE_SPEECH_SLUR_PATTERNS,
  HARASSMENT_TOXICITY_PATTERNS,
} from "../consts";

export function normalizeText(raw: string): string {
  let s = raw.toLowerCase();
  s = s.replace(/ค[_.\-\s]+ย/g, "ควย");
  s = s.replace(/เ[_.\-\s]+ด/g, "เย็ด");
  s = s.replace(/เหี้[_.\-\s]+ย/g, "เหี้ย");
  s = s.replace(/สั[_.\-\s]+ส/g, "สัส");
  s = s.replace(/f[4a@][gq9]{1,2}[0o]t?5?/g, "faggot");
  s = s.replace(/n[i1!|][gq9]{1,2}[e3a@]r?/g, "nigger");
  s = s.replace(/b[i1!|]tch/g, "bitch");
  return s;
}

export function splitChunks(text: string, maxChunks = 8): string[] {
  const bounded = text.slice(0, 4000);
  const clauses = bounded
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  return [bounded, ...clauses].slice(0, maxChunks);
}

export function checkTier0Lexicon(text: string): {
  matched: boolean;
  category?: string;
  reason?: string;
  ratios?: TextRatios;
} {
  const normalized = normalizeText(text);

  if (ADULT_PROMOTION_PATTERNS.some((p) => p.test(normalized))) {
    return {
      matched: true,
      category: "nsfw_content",
      reason: "Sexually explicit or adult content detected via lexicon",
      ratios: { nsfw: 1.0, toxic: 0.0, violence: 0.0, neutral: 0.0 },
    };
  }

  if (VIOLENCE_GORE_PATTERNS.some((p) => p.test(normalized))) {
    return {
      matched: true,
      category: "graphic_violence",
      reason: "Graphic violence, physical threats, or gore detected via lexicon",
      ratios: { nsfw: 0.0, toxic: 0.0, violence: 1.0, neutral: 0.0 },
    };
  }

  if (HATE_SPEECH_SLUR_PATTERNS.some((p) => p.test(normalized))) {
    return {
      matched: true,
      category: "hate_speech",
      reason: "Hate speech, identity slurs, or harassment detected via lexicon",
      ratios: { nsfw: 0.0, toxic: 1.0, violence: 0.0, neutral: 0.0 },
    };
  }

  if (HARASSMENT_TOXICITY_PATTERNS.some((p) => p.test(normalized))) {
    return {
      matched: true,
      category: "harassment",
      reason: "Harassment or toxic conduct detected via lexicon",
      ratios: { nsfw: 0.0, toxic: 1.0, violence: 0.0, neutral: 0.0 },
    };
  }

  return { matched: false };
}
