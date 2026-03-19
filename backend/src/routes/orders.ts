import { Router } from "express";
import { createOrder } from "../services/orderService";

const router = Router();

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

