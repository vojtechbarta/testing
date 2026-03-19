import { Router } from "express";
import { listEnabledUiFaultConfigs } from "../faults/faultRuntime";

const router = Router();

// Veřejné, jen pro "UI level" injekce (např. double-call při kliknutí).
router.get("/ui", async (_req, res, next) => {
  try {
    const faults = await listEnabledUiFaultConfigs();
    res.json({ faults });
  } catch (err) {
    next(err);
  }
});

export default router;

