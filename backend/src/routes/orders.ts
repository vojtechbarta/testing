import { Router } from "express";
import { createOrder } from "../services/orderService";

const router = Router();

/**
 * @openapi
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Create direct order from user and items payload.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: integer }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId: { type: integer }
 *                     quantity: { type: integer }
 *                   required: [productId, quantity]
 *             required: [userId, items]
 *     responses:
 *       201:
 *         description: Order created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Invalid payload.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post("/", async (req, res, next) => {
  try {
    const { userId, items } = req.body as {
      userId: number;
      items: { productId: number; quantity: number }[];
    };

    if (!userId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid order payload" });
    }

    const order = await createOrder(userId, items);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

export default router;

