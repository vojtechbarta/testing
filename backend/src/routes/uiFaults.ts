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

/** Endpoint used by UI fault `networ_inject_api_fail_every minute` to create visible 400s in DevTools Network. */
router.get("/inject-error", (req, res) => {
  const lang = req.query.lang === "cs" ? "cs" : "en";
  const message = lang === "cs" ? "tohle je bug" : "this is bug";
  res.status(400).json({ message });
});

export default router;

