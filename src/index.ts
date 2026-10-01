import { Hono } from "hono/tiny";
import { logger } from "./core/logger";
import { configManager } from "./core/config";
import { validateApiKey } from "./utils/auth";
import { ipFromContext } from "./utils/ipParser";
import { router } from "./routes";

const app = new Hono();
const config = configManager.get();

if (process.env.NODE_ENV !== "test") {
  configManager.printStatusCard();
  configManager.printWarningCard();
}

// Traffic logging and CORS middleware
app.use("*", async (c, next) => {
  const start = performance.now();
  const clientIp = ipFromContext(c);

  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  logger.trafficPending(c.req.method, c.req.path, clientIp);

  await next();
  logger.traffic(c.req.method, c.req.path, c.res.status, performance.now() - start, clientIp);
});

// Authentication Guard
app.use("/v1/*", async (c, next) => {
  if (config.apiKey) {
    const authHeader = c.req.header("authorization");
    const apiKeyHeader = c.req.header("x-api-key");
    const queryKey = c.req.query("apiKey");

    if (!validateApiKey(authHeader, apiKeyHeader, queryKey, config.apiKey)) {
      return c.json({ error: "Unauthorized: Invalid or missing API key" }, 401);
    }
  }
  await next();
});

// Mount Centralized Routes
app.route("/", router);

export default {
  port: config.port,
  fetch: app.fetch,
};
