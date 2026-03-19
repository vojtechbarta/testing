import { Router } from "express";
import {
  createProduct,
  getAllProductsForAdmin,
  updateProduct,
} from "../services/productService";
import { roleAuth } from "../middleware/adminAuth";
import { UserRole } from "@prisma/client";

const router = Router();

router.use(roleAuth([UserRole.ADMIN]));

router.get("/", async (_req, res, next) => {
  try {
    const products = await getAllProductsForAdmin();
    res.json(products);
  } catch (err) {
    next(err);
  }
});

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

export default router;

