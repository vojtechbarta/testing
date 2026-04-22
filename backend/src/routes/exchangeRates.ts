import { Router } from "express";
import { UserRole } from "@prisma/client";
import { roleAuth } from "../middleware/adminAuth";
import { syncDailyCnbExchangeRates } from "../services/cnbExchangeRateSyncService";
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

/**
 * @openapi
 * /exchange-rates/sync-now:
 *   post:
 *     tags: [ExchangeRates]
 *     summary: Trigger immediate CNB exchange-rate sync for testing.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: 2026-04-22
 *                 description: Optional target date in YYYY-MM-DD format.
 *     responses:
 *       200:
 *         description: Sync succeeded.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 effectiveDate: { type: string, format: date, example: 2026-04-22 }
 *                 importedCount: { type: integer, example: 30 }
 *               required: [effectiveDate, importedCount]
 *       400:
 *         description: Invalid date.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Forbidden for non-tester roles.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post("/sync-now", roleAuth([UserRole.TESTER]), async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as { date?: string };
    const dateStr = body.date?.trim();
    if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.status(400).json({ message: "date must be in YYYY-MM-DD format" });
      return;
    }
    const targetDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
    if (dateStr && Number.isNaN(targetDate.getTime())) {
      res.status(400).json({ message: "date must be in YYYY-MM-DD format" });
      return;
    }
    if (dateStr && targetDate.toISOString().slice(0, 10) !== dateStr) {
      res.status(400).json({ message: "date must be a real calendar date in YYYY-MM-DD format" });
      return;
    }
    const result = await syncDailyCnbExchangeRates(targetDate);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
