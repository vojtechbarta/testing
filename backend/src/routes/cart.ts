import { Router } from "express";
import prisma from "../db/prisma";
import { addOrUpdateCartItem, getCart } from "../services/cartService";
import { FAULT_KEYS, shouldTriggerFault } from "../faults/faultRuntime";
import { requireCartSessionIdHeader } from "../utils/cartSession";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const cartKey = requireCartSessionIdHeader(req.get("x-cart-session"));
    const cart = await getCart(cartKey);
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

router.post("/items", async (req, res, next) => {
  try {
    const cartKey = requireCartSessionIdHeader(req.get("x-cart-session"));
    const { productId, quantity } = req.body as {
      productId: number;
      quantity: number;
    };

    if (!productId || typeof quantity !== "number") {
      return res.status(400).json({ message: "Invalid cart payload" });
    }

    try {
      let quantityToSave = quantity;

      if (quantityToSave > 0) {
        const existing = await prisma.cartItem.findFirst({
          where: { cartKey, productId },
        });
        const existingQty = existing?.quantity ?? 0;

        if (quantityToSave > existingQty) {
          const shouldTrigger = await shouldTriggerFault(
            FAULT_KEYS.apiCartAddDoubleQuantityPayload,
          );
          if (shouldTrigger) {
            const delta = quantityToSave - existingQty;
            quantityToSave = existingQty + delta * 2;
          }
        }
      }

      const cart = await addOrUpdateCartItem(
        cartKey,
        productId,
        quantityToSave,
      );
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
