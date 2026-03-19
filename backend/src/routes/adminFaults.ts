import { Router } from "express";
import { roleAuth } from "../middleware/adminAuth";
import { getAllFaultConfigs, upsertFaultConfig } from "../services/faultAdminService";
import { UserRole } from "@prisma/client";

const router = Router();

router.use(roleAuth([UserRole.ADMIN, UserRole.TESTER]));

router.get("/", async (_req, res, next) => {
  try {
    const faults = await getAllFaultConfigs();
    res.json(faults);
  } catch (err) {
    next(err);
  }
});

router.patch("/:key", async (req, res, next) => {
  try {
    const { key } = req.params;
    const { enabled, latencyMs, failureRate } = req.body as {
      enabled?: boolean;
      latencyMs?: number | null;
      failureRate?: number | null;
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
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;

