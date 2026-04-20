import { afterAll, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import prisma from "../../db/prisma";
import { cleanupIntegrationFixtures } from "./cleanup";

export const app = createApp();

let activeSuites = 0;
let seededProductId: number | null = null;

type InternalApiSuiteOptions = {
  suiteId?: string;
  cartKeys?: string[];
  cleanupProducts?: boolean;
  dedicatedProduct?: boolean;
};

const suiteProductIds = new Map<string, number>();

async function ensureSeededProductId(): Promise<number> {
  if (seededProductId !== null) {
    return seededProductId;
  }

  const first = await prisma.product.findFirst({
    where: { active: true },
    orderBy: { id: "asc" },
  });
  if (!first) {
    throw new Error(
      "No active product in DB — run `npx prisma migrate deploy` and `npm run prisma:seed`",
    );
  }

  seededProductId = first.id;
  return seededProductId;
}

export function getSeededProductId(): number {
  if (seededProductId === null) {
    throw new Error("Seeded product id is not initialized. Call setupInternalApiSuite() first.");
  }
  return seededProductId;
}

export function getSuiteProductId(suiteId: string): number {
  const productId = suiteProductIds.get(suiteId);
  if (!productId) {
    throw new Error(`Suite product id is not initialized for suite "${suiteId}".`);
  }
  return productId;
}

export function setupInternalApiSuite(options: InternalApiSuiteOptions = {}) {
  const suiteId = options.suiteId ?? "default";
  const cleanupOptions: {
    cartKeys: string[];
    cleanupProducts: boolean;
    productIds: number[];
  } = {
    cartKeys: options.cartKeys ?? [],
    cleanupProducts: options.cleanupProducts ?? false,
    productIds: [],
  };

  beforeAll(async () => {
    if (activeSuites === 0) {
      await prisma.$connect();
      await ensureSeededProductId();
    }

    await cleanupIntegrationFixtures(cleanupOptions);

    if (options.dedicatedProduct) {
      const token = (
        await request(app)
          .post("/auth/login")
          .send({ username: "admin", password: "admin" })
          .expect(200)
      ).body.token as string;

      const product = (
        await request(app)
          .post("/admin/products")
          .set("Authorization", `Bearer ${token}`)
          .set("Content-Type", "application/json")
          .send({
            name: `Integration Fixture Product ${suiteId} ${Date.now()}`,
            description: `Fixture product for integration suite ${suiteId}`,
            price: { amount: 99, currencyCode: "EUR" },
            inStock: 200,
            active: true,
          })
          .expect(201)
      ).body as { id: number };

      suiteProductIds.set(suiteId, product.id);
      cleanupOptions.productIds = [product.id];
    }
    activeSuites += 1;
  });

  afterAll(async () => {
    await cleanupIntegrationFixtures(cleanupOptions);
    if (options.dedicatedProduct) {
      suiteProductIds.delete(suiteId);
    }
    activeSuites -= 1;
    if (activeSuites === 0) {
      await prisma.$disconnect();
      seededProductId = null;
    }
  });
}
