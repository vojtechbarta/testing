import { Router } from "express";
import {
  getStorefrontCatalog,
  parseStorefrontCatalogQuery,
} from "../services/storefrontCatalogService";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { q, lang, sort, priceMin, priceMax } = parseStorefrontCatalogQuery({
      query: req.query as Record<string, unknown>,
    });
    const payload = await getStorefrontCatalog({
      searchQuery: q,
      lang,
      sort,
      priceMin,
      priceMax,
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;

