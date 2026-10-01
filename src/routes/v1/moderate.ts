import { Hono } from "hono/tiny";
import { logger } from "../../core/logger";
import { Moderator } from "../../core/moderator";
import { resolveImageBuffer } from "../../utils/image";
import type { UnifiedModerationRequest } from "../../types";

export const moderateRouter = new Hono();

// Unified moderation
moderateRouter.post("/", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const req: UnifiedModerationRequest = {
      text: body.text,
      image: body.image,
      imageUrl: body.imageUrl || body.url,
    };

    if (!req.text && !req.image && !req.imageUrl) {
      return c.json({ error: "Missing 'text' or 'image'/'imageUrl' parameter" }, 400);
    }

    const res = await Moderator.moderate(req);
    return c.json(res);
  } catch (err: any) {
    logger.error("Unified moderation handler error", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// Text moderation
moderateRouter.post("/text", async (c) => {
  try {
    let text = "";
    const contentType = c.req.header("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await c.req.json().catch(() => ({}));
      text = body.text || "";
    } else {
      text = await c.req.text();
    }

    if (!text || !text.trim()) {
      return c.json({ error: "Missing 'text' parameter in request" }, 400);
    }

    const res = await Moderator.moderateText(text);
    return c.json(res);
  } catch (err: any) {
    logger.error("Text moderation handler error", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// Image moderation
moderateRouter.post("/image", async (c) => {
  try {
    const contentType = c.req.header("content-type") || "";
    let buffer: Buffer | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await c.req.formData();
      const file = (form.get("file") || form.get("image")) as File | null;
      if (file && typeof file.arrayBuffer === "function") {
        buffer = Buffer.from(await file.arrayBuffer());
      }
    } else if (contentType.includes("application/json")) {
      const body = await c.req.json().catch(() => ({}));
      const input = body.image || body.imageUrl || body.url;
      if (input) {
        buffer = await resolveImageBuffer(input);
      }
    } else if (contentType.startsWith("image/")) {
      const arrayBuf = await c.req.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    } else {
      const body = await c.req.json().catch(() => ({}));
      const input = body.image || body.imageUrl || body.url;
      if (input) {
        buffer = await resolveImageBuffer(input);
      }
    }

    if (!buffer || buffer.length === 0) {
      return c.json(
        { error: "Missing or invalid image. Provide multipart 'file', JSON 'image' (base64/URL), or raw binary." },
        400
      );
    }

    const res = await Moderator.moderateImage(buffer);
    return c.json(res);
  } catch (err: any) {
    logger.error("Image moderation handler error", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default moderateRouter;
