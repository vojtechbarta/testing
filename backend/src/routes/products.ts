import { Router } from "express";
import {
  getStorefrontCatalog,
  parseStorefrontCatalogQuery,
} from "../services/storefrontCatalogService";

const router = Router();

/**
 * @openapi
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Get storefront product catalog with filtering/sorting/localization.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search term for name/description.
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [en, cs]
 *         description: Storefront language.
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name-asc, name-desc, price-asc, price-desc]
 *       - in: query
 *         name: priceMin
 *         schema: { type: number }
 *       - in: query
 *         name: priceMax
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Storefront catalog response.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/StorefrontCatalogResponse' }
 */
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

