import { Router } from "express";
import { getAllExchangeRates } from "../services/exchangeRateService";
import { getExchangeRateSyncStatus } from "../services/exchangeRateSyncScheduler";

const router = Router();

/**
 * @openapi
 * /exchange-rates:
 *   get:
 *     tags: [ExchangeRates]
 *     summary: List exchange rates used for storefront currency conversion.
 *     responses:
 *       200:
 *         description: Exchange rate rows.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   fromCurrencyCode: { type: string, example: EUR }
 *                   toCurrencyCode: { type: string, example: CZK }
 *                   sourceAmount: { type: integer, example: 1 }
 *                   exchangeRate: { type: number, example: 24 }
 *                   source: { type: string, example: CNB_API }
 *                   effectiveDate: { type: string, format: date, example: 2026-04-22 }
 *                   isStale: { type: boolean, example: false }
 *                 required: [fromCurrencyCode, toCurrencyCode, sourceAmount, exchangeRate, source, effectiveDate, isStale]
 */
router.get("/", async (_req, res, next) => {
  try {
    const rates = await getAllExchangeRates();
    res.json(rates);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /exchange-rates/sync-status:
 *   get:
 *     tags: [ExchangeRates]
 *     summary: Read latest exchange-rate sync status/metrics.
 *     responses:
 *       200:
 *         description: Current scheduler status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lastSuccessfulSyncAt: { type: string, nullable: true, format: date-time }
 *                 lastImportedCount: { type: integer, example: 30 }
 *                 lastAttemptedLocalDate: { type: string, nullable: true, format: date, example: 2026-04-22 }
 *               required: [lastSuccessfulSyncAt, lastImportedCount, lastAttemptedLocalDate]
 */
router.get("/sync-status", (_req, res) => {
  res.json(getExchangeRateSyncStatus());
});

export default router;
