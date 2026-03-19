import { Router } from "express";
import { listEnabledUiFaultKeys } from "../faults/faultRuntime";

const router = Router();

// Veřejné, jen pro "UI level" injekce (např. double-call při kliknutí).
router.get("/ui", async (_req, res, next) => {
  try {
    const keys = await listEnabledUiFaultKeys();
    res.json({ keys });
  } catch (err) {
    next(err);
  }
});

export default router;

