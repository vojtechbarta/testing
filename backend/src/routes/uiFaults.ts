import { Router } from "express";
import { listEnabledUiFaultConfigs } from "../faults/faultRuntime";

const router = Router();

// Veřejné, jen pro "UI level" injekce (např. double-call při kliknutí).
/**
 * @openapi
 * /faults/ui:
 *   get:
 *     tags: [Faults]
 *     summary: List currently enabled UI fault configs for frontend behavior toggles.
 *     responses:
 *       200:
 *         description: Enabled UI faults with resolved failureRate.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 faults:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key: { type: string }
 *                       failureRate: { type: number }
 *                     required: [key, failureRate]
 *               required: [faults]
 */
router.get("/ui", async (_req, res, next) => {
  try {
    const faults = await listEnabledUiFaultConfigs();
    res.json({ faults });
  } catch (err) {
    next(err);
  }
});

/** Endpoint used by UI fault `networ_inject_api_fail_every minute` to create visible 400s in DevTools Network. */
/**
 * @openapi
 * /faults/inject-error:
 *   get:
 *     tags: [Faults]
 *     summary: Return intentional localized 400 response for network-fault training.
 *     parameters:
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [en, cs]
 *     responses:
 *       400:
 *         description: Intentional bug response.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get("/inject-error", (req, res) => {
  const lang = req.query.lang === "cs" ? "cs" : "en";
  const message = lang === "cs" ? "tohle je bug" : "this is bug";
  res.status(400).json({ message });
});

export default router;

