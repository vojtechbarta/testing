import { Router } from "express";
import prisma from "../db/prisma";
import { addOrUpdateCartItem, getCart } from "../services/cartService";
import { FAULT_KEYS, isFaultEnabled } from "../faults/faultRuntime";

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
      // Pomocná proměnná pro případné fault mutace (nesmí to být `const`).
      let quantityToSave = quantity;

      // API mutace: v payload od UI (pro přidání 1 ks) uložíme dvojnásobnou "delta"
      // oproti aktuálnímu množství v košíku.
      if (quantityToSave > 0) {
        const existing = await prisma.cartItem.findFirst({
          where: { userId: 1, productId },
        });
        const existingQty = existing?.quantity ?? 0;

        if (quantityToSave > existingQty) {
          const enabled = await isFaultEnabled(
            FAULT_KEYS.apiCartAddDoubleQuantityPayload,
          );
          if (enabled) {
            const delta = quantityToSave - existingQty;
            quantityToSave = existingQty + delta * 2;
          }
        }
      }

      const cart = await addOrUpdateCartItem(productId, quantityToSave);
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

