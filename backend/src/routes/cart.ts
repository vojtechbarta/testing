import { Router } from "express";
import prisma from "../db/prisma";
import {
  addOrUpdateCartItem,
  applyCartPromotion,
  getCart,
} from "../services/cartService";
import { FAULT_KEYS, shouldTriggerFault } from "../faults/faultRuntime";
import type { StorefrontLang } from "../shop/storefrontMoney";
import { requireCartSessionIdHeader } from "../utils/cartSession";

const router = Router();

function parseStorefrontLang(req: { query: Record<string, unknown> }): StorefrontLang {
  return req.query.lang === "cs" ? "cs" : "en";
}

/**
 * @openapi
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get cart by session header.
 *     parameters:
 *       - $ref: '#/components/parameters/CartSessionHeader'
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [en, cs]
 *         description: Storefront language used for line names and display money.
 *     responses:
 *       200:
 *         description: Cart DTO.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Cart' }
 *       400:
 *         description: Invalid session key.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get("/", async (req, res, next) => {
  try {
    const cartKey = requireCartSessionIdHeader(req.get("x-cart-session"));
    const lang = parseStorefrontLang(req);
    const cart = await getCart(cartKey, lang);
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add/update/remove a cart line by absolute quantity.
 *     parameters:
 *       - $ref: '#/components/parameters/CartSessionHeader'
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [en, cs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId: { type: integer }
 *               quantity: { type: integer }
 *             required: [productId, quantity]
 *     responses:
 *       200:
 *         description: Updated cart DTO.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Cart' }
 *       400:
 *         description: Validation/service error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
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

      const lang = parseStorefrontLang(req);
      const cart = await addOrUpdateCartItem(
        cartKey,
        productId,
        quantityToSave,
        lang,
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

/**
 * @openapi
 * /cart/promotion:
 *   post:
 *     tags: [Cart]
 *     summary: Apply or clear a promotion code on the cart session.
 *     parameters:
 *       - $ref: '#/components/parameters/CartSessionHeader'
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [en, cs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Updated cart DTO.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Cart' }
 *       400:
 *         description: Unknown code or validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post("/promotion", async (req, res, next) => {
  try {
    const cartKey = requireCartSessionIdHeader(req.get("x-cart-session"));
    const lang = parseStorefrontLang(req);
    const body = req.body as { code?: string | null };
    const code =
      body?.code === undefined || body?.code === null
        ? null
        : String(body.code);

    try {
      const cart = await applyCartPromotion(cartKey, code, lang);
      res.status(200).json(cart);
    } catch (serviceErr) {
      const message =
        serviceErr instanceof Error
          ? serviceErr.message
          : "Promotion update failed";
      res.status(400).json({ message });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
