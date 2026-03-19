import { Router } from "express";
import { addOrUpdateCartItem, getCart } from "../services/cartService";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const cart = await getCart();
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

router.post("/items", async (req, res, next) => {
  try {
    const { productId, quantity } = req.body as {
      productId: number;
      quantity: number;
    };

    if (!productId || typeof quantity !== "number") {
      return res.status(400).json({ message: "Invalid cart payload" });
    }

    try {
      const cart = await addOrUpdateCartItem(productId, quantity);
      res.status(200).json(cart);
    } catch (serviceErr) {
      const message =
        serviceErr instanceof Error
          ? serviceErr.message
          : "Cart update failed";
      res.status(400).json({ message });
    }
  } catch (err) {
    next(err);
  }
});

export default router;

