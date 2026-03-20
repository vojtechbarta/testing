import { Router } from "express";
import { getAllProducts } from "../services/productService";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const products = await getAllProducts(q);
    res.json(products);
  } catch (err) {
    next(err);
  }
});

export default router;

