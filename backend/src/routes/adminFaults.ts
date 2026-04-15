import { Router } from "express";
import { roleAuth } from "../middleware/adminAuth";
import { invalidateFaultRuntimeCache } from "../faults/faultRuntime";
import { getAllFaultConfigs, upsertFaultConfig } from "../services/faultAdminService";
import { UserRole } from "@prisma/client";

const router = Router();

router.use(roleAuth([UserRole.ADMIN, UserRole.TESTER]));

/**
 * @openapi
 * /admin/faults:
 *   get:
 *     tags: [Faults]
 *     summary: List all fault configurations for admin/tester.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fault config list.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/AdminFault' }
 */
router.get("/", async (_req, res, next) => {
  try {
    const faults = await getAllFaultConfigs();
    res.json(faults);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/faults/{key}:
 *   patch:
 *     tags: [Faults]
 *     summary: Update a single fault config by key.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *               latencyMs: { type: number, nullable: true }
 *               failureRate: { type: number, nullable: true }
 *               name: { type: string }
 *               description: { type: string }
 *               level:
 *                 type: string
 *                 enum: [UI, API, Unit]
 *     responses:
 *       200:
 *         description: Updated fault config.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AdminFault' }
 *       400:
 *         description: Invalid key or payload.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch("/:key", async (req, res, next) => {
  try {
    const { key } = req.params;
    const { enabled, latencyMs, failureRate, name, description, level } = req.body as {
      enabled?: boolean;
      latencyMs?: number | null;
      failureRate?: number | null;
      name?: string;
      description?: string;
      level?: string;
    };

    if (!key) {
      res.status(400).json({ message: "Fault key is required" });
      return;
    }

    const parsedLatency =
      typeof latencyMs === "number" || latencyMs === null
        ? latencyMs
        : latencyMs === undefined
          ? undefined
          : Number(latencyMs);

    const parsedFailureRate =
      typeof failureRate === "number" || failureRate === null
        ? failureRate
        : failureRate === undefined
          ? undefined
          : Number(failureRate);

    const updated = await upsertFaultConfig(key, {
      enabled,
      latencyMs: parsedLatency,
      failureRate: parsedFailureRate,
      name,
      description,
      level,
    });

    invalidateFaultRuntimeCache();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;

