import type {
  TextModerationResult,
  ImageModerationResult,
  UnifiedModerationRequest,
  UnifiedModerationResponse,
} from "../types";
import { TextModerator } from "./textModerator";
import { ImageModerator } from "./imageModerator";
import { resolveImageBuffer } from "../utils/image";

export class Moderator {
  public static async moderateText(text: string): Promise<TextModerationResult> {
    return TextModerator.moderate(text);
  }

  public static async moderateImage(imageBuffer: Buffer): Promise<ImageModerationResult> {
    return ImageModerator.moderate(imageBuffer);
  }

  public static async moderate(req: UnifiedModerationRequest): Promise<UnifiedModerationResponse> {
    const start = performance.now();
    let textResult: TextModerationResult | undefined;
    let imageResult: ImageModerationResult | undefined;

    if (req.text) {
      textResult = await TextModerator.moderate(req.text);
    }

    const imageInput = req.image || req.imageUrl;
    if (imageInput) {
      const buffer = await resolveImageBuffer(imageInput);
      if (buffer) {
        imageResult = await ImageModerator.moderate(buffer);
      }
    }

    const flagged = Boolean(textResult?.flagged || imageResult?.flagged);

    return {
      flagged,
      text: textResult,
      image: imageResult,
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }
}
