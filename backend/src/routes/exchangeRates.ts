import { Router } from "express";
import { getAllExchangeRates } from "../services/exchangeRateService";

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
 *                   exchangeRate: { type: number, example: 24 }
 *                 required: [fromCurrencyCode, toCurrencyCode, exchangeRate]
 */
router.get("/", async (_req, res, next) => {
  try {
    const rates = await getAllExchangeRates();
    res.json(rates);
  } catch (err) {
    next(err);
  }
});

export default router;
