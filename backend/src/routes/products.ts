import { Router } from "express";
import { getAllProducts } from "../services/productService";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const products = await getAllProducts();
    res.json(products);
  } catch (err) {
    next(err);
  }
});

export default router;

