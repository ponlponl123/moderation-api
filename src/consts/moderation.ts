/**
 * DISCLAIMER: 
 * ============================================================================
 * CONTENT MODERATION & SAFETY RESEARCH DISCLAIMER
 * ============================================================================
 * The anchor texts, regular expression patterns, and lexical benchmarks defined
 * in this file contain explicit, offensive, sexually suggestive, and sensitive
 * terms strictly for the engineering purpose of automated content moderation,
 * semantic vector filtering, and defensive abuse protection.
 *
 * These terms serve as algorithmic benchmark controls and do not represent the
 * personal views, opinions, or endorsement of the creators or maintainers.
 * ============================================================================
 */

import type { ModerationConfig } from "../types";

export const MODERATION_DISCLAIMER =
  "These lexicons, anchors, and test patterns exist strictly for automated defensive content moderation, filtering, and safety benchmark controls. They do not represent endorsement of harmful, toxic, or explicit material.";

export const DEFAULT_MODERATION_CONFIG: ModerationConfig = {
  port: 4003,
  enabled: true,
  textEnabled: true,
  imageEnabled: true,
  cpuThreads: 1,
  textThreshold: 0.45,
  imageThreshold: 0.50,
  pornThreshold: 0.40,
  hentaiThreshold: 0.40,
  sexyThreshold: 0.60,
  toxicThreshold: 0.45,
  violenceThreshold: 0.45,
  cacheTtlSec: 604800,
  imageModel: "onnx-community/nsfw-image-detector-ONNX",
  textModel: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
};

export const TOXIC_ANCHOR_TEXT =
  "toxic hate offensive profanity slurs insults violence threats abuse bullying troll trash players ruin day soft bitch fuck shit bitch bastard cunt เหี้ย สัส มึง กู ชาติชั่ว สถุล เลว ส้นตีน ส้นเท้า กวนตีน ป่วนสตรีมเมอร์ อ่อนก็แพ้ไปนอน";

export const NSFW_ANCHOR_TEXT =
  "nsfw adult porn explicit sexual intercourse onlyfans fansly nudes uncensored fetish private chats cum creampie nude naked pussy boobs penis dick dildo masturbation erotic eroticism sex sexual organs fetish orgasm สายหื่น สตรีมสดติดเรท ยั่วๆ คลิปหลุด งานลับ คอลเสียว กลุ่มลับ รับประกันความแซ่บ หี ควย เย็ด เงี่ยน ดูดควย เลียหี น้ำแตก แตกใน เสียว อมชมพู อมควย ช่วยตัวเอง มีเพศสัมพันธ์ ลามก อนาจาร";

export const VIOLENCE_ANCHOR_TEXT =
  "graphic violence gore physical threats kill murder beat to death bleed out rip heads off blood and guts slit throat กระโหลกแตก เลือดอาบ กระทืบให้จมดิน ฆ่าปาดคอ ฟันคอ แทงให้ตาย ล่าหัว";

export const ADULT_PROMOTION_PATTERNS: RegExp[] = [
  /\b(onlyfans|fansly|fansone)\b/i,
  /\b(nudes?|fetish|uncensored\s+content)\b/i,
  /\b(sub\s+to\s+my\s+(of|onlyfans))\b/i,
  /(สายหื่น|คลิปหลุด|งานลับ|คอลเสียว|กลุ่มลับ|รับงาน|ขายคลิป)/i,
  /18\+\s*(ยั่ว|เสียว|คลิป|nsfw|หื่น)/i,
  /\b(cum|creampie|blowjob|handjob|anal|gangbang|porn|xxx|hentai|nsfw|dildo|vagina|penis|cock|dick|boobs|tits|nude|naked|erotic|orgasm|masturbat\w*)\b/i,
  /\b(wet|pink|inside\s+my|send\s+you\s+my)\s+kitty\b/i,
  /\b(kitty\s+view)\b/i,
  /\b(play\s+with\s+[^\n.!?]{0,30}?cucumber|massive\s+cucumber)\b/i,
  /หี(?!้|ย|บ|ด)/i,
  /ควย/i,
  /เย็ด/i,
  /เงี่ยน/i,
  /อมควย/i,
  /เลียหี/i,
  /น้ำแตก/i,
  /แตกใน/i,
  /จิ๋ม/i,
  /หรรม/i,
  /ช่วยตัวเอง/i,
];

export const VIOLENCE_GORE_PATTERNS: RegExp[] = [
  /\b(blood\s+and\s+guts|rip\s+heads?\s+off|bleed\s+out|beat[^\n.!?]{0,50}?till\s+they\s+bleed|beat[^\n.!?]{0,50}?to\s+death|slit[^\n.!?]{0,30}?throat)\b/i,
  /(กูจะกระทืบ|กระทืบให้จมดิน|กระโหลก.{0,20}?แตก|เลือดอาบ|ล่าหัว|ฆ่าปาดคอ|ฟันคอ|แทงให้ตาย)/i,
];

export const HATE_SPEECH_SLUR_PATTERNS: RegExp[] = [
  /\b(faggot|nigger|nigga|retard|kike|chink|tranny)\b/i,
  /(เพศที่สามประสาทแดก|กะเทยควาย|ตุ๊ดสถุล|ไอ้ปัญญาอ่อน|ชาติชั่ว|สถุล|ประสาทแดก)/i,
];

export const HARASSMENT_TOXICITY_PATTERNS: RegExp[] = [
  /\b(fuck|shit|bitch|bastard|cunt|asshole|idiot|retard)\b/i,
  /\b(soft\s+bitch|ruin\s+your[^\n.!?]{0,30}?streamer|hunt\s+trash\s+players)\b/i,
  /กวนส้น(ตีน|เท้า)/i,
  /กวนตีน/i,
  /อย่ามาเสนอหน้า/i,
  /ไปตายซะ/i,
];

export const SAMPLE_1X1_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
