import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import cartRouter from "./routes/cart";
import authRouter from "./routes/auth";
import adminProductsRouter from "./routes/adminProducts";
import adminFaultsRouter from "./routes/adminFaults";
import uiFaultsRouter from "./routes/uiFaults";
import checkoutRouter from "./routes/checkout";
import exchangeRatesRouter from "./routes/exchangeRates";
import { openApiSpec } from "./docs/openapi";

/** Vite dev server may be opened as localhost or 127.0.0.1 — both must be allowed (Playwright uses 127.0.0.1 by default). */
const FRONTEND_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function corsAllowedOrigins(): string[] {
  const fromEnv =
    process.env.CORS_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  if (process.env.NODE_ENV === "production") {
    return fromEnv;
  }
  return [...new Set([...FRONTEND_DEV_ORIGINS, ...fromEnv])];
}

export function createApp(): express.Express {
  const app = express();

  const isProd = process.env.NODE_ENV === "production";

  app.use(
    cors({
      // Dev: reflect any request origin so http://localhost:* and http://127.0.0.1:* both work
      // (browser treats them as different sites; a fixed allowlist breaks "Failed to fetch").
      origin: isProd ? corsAllowedOrigins() : true,
      allowedHeaders: ["Content-Type", "X-Cart-Session", "Authorization"],
    }),
  );

  app.use(express.json());

  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [System]
   *     summary: Liveness probe endpoint.
   *     responses:
   *       200:
   *         description: Service is healthy.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, example: ok }
   *               required: [status]
   */
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  /**
   * @openapi
   * /docs-json:
   *   get:
   *     tags: [System]
   *     summary: Generated OpenAPI JSON document.
   *     responses:
   *       200:
   *         description: OpenAPI specification.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */
  app.get("/docs-json", (_req, res) => {
    res.json(openApiSpec);
  });
  /**
   * @openapi
   * /docs:
   *   get:
   *     tags: [System]
   *     summary: Interactive Swagger UI.
   *     responses:
   *       200:
   *         description: HTML Swagger UI page.
   */
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use("/auth", authRouter);
  app.use("/products", productsRouter);
  app.use("/exchange-rates", exchangeRatesRouter);
  app.use("/orders", ordersRouter);
  app.use("/checkout", checkoutRouter);
  app.use("/cart", cartRouter);
  app.use("/admin/products", adminProductsRouter);
  app.use("/admin/faults", adminFaultsRouter);
  app.use("/faults", uiFaultsRouter);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const message = err instanceof Error ? err.message : "Internal error";
      const clientIssue =
        /required|empty|not found|Insufficient|not available|cannot be processed|no longer awaiting|not using|X-Cart-Session/i.test(
          message,
        );
      res.status(clientIssue ? 400 : 500).json({ message });
    },
  );

  return app;
}
