import { Hono } from "hono/tiny";
import { rootRouter } from "./root";
import { healthRouter } from "./health";
import { v1Router } from "./v1";
import { moderateRouter } from "./v1/moderate";

export const router = new Hono();

router.route("/", rootRouter);
router.route("/health", healthRouter);
router.route("/v1", v1Router);

// Top-level aliases for flexibility
router.route("/moderate", moderateRouter);

export default router;
