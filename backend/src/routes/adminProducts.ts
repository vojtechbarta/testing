import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getAllProductsForAdmin,
  updateProduct,
} from "../services/productService";
import prisma from "../db/prisma";
import { roleAuth } from "../middleware/adminAuth";
import { UserRole } from "@prisma/client";

const router = Router();

router.use(roleAuth([UserRole.ADMIN]));

/**
 * @openapi
 * /admin/products:
 *   get:
 *     tags: [Products]
 *     summary: List all products for admin editing.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product list for admin.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Product' }
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get("/", async (_req, res, next) => {
  try {
    const products = await getAllProductsForAdmin();
    res.json(products);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/products:
 *   post:
 *     tags: [Products]
 *     summary: Create product as admin.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               inStock: { type: integer }
 *               active: { type: boolean }
 *               price:
 *                 type: object
 *                 properties:
 *                   amount: { type: number }
 *                   currencyCode: { type: string, example: CZK }
 *                 required: [amount, currencyCode]
 *             required: [name, description, inStock, active, price]
 *     responses:
 *       201:
 *         description: Product created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       400:
 *         description: Invalid payload.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post("/", async (req, res, next) => {
  try {
    const { name, description, price, inStock, active } = req.body as {
      name: string;
      description: string;
      price: { amount: number; currencyCode: string };
      inStock: number;
      active: boolean;
    };

    if (!name || !description) {
      res.status(400).json({ message: "Name and description are required" });
      return;
    }

    const product = await createProduct({
      name,
      description,
      price: {
        amount: Number(price.amount),
        currencyCode: price.currencyCode,
      },
      inStock: Number(inStock),
      active: Boolean(active),
    });

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Update product by id as admin.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               inStock: { type: integer }
 *               active: { type: boolean }
 *               price:
 *                 type: object
 *                 properties:
 *                   amount: { type: number }
 *                   currencyCode: { type: string, example: CZK }
 *                 required: [amount, currencyCode]
 *             required: [name, description, inStock, active, price]
 *     responses:
 *       200:
 *         description: Product updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 */
router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, description, price, inStock, active } = req.body as {
      name: string;
      description: string;
      price: { amount: number; currencyCode: string };
      inStock: number;
      active: boolean;
    };

    if (!id || Number.isNaN(id)) {
      res.status(400).json({ message: "Invalid product id" });
      return;
    }

    const product = await updateProduct(id, {
      name,
      description,
      price: {
        amount: Number(price.amount),
        currencyCode: price.currencyCode,
      },
      inStock: Number(inStock),
      active: Boolean(active),
    });

    res.json(product);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Delete product by id as admin.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Product deleted.
 *       400:
 *         description: Invalid id.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Product not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ message: "Invalid product id" });
      return;
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    await deleteProduct(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

