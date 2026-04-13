import { Router } from "express";
import { getAllExchangeRates } from "../services/exchangeRateService";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const rates = await getAllExchangeRates();
    res.json(rates);
  } catch (err) {
    next(err);
  }
});

export default router;
