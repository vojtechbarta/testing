import { FaultLevel, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("admin", 10);
  const testerPasswordHash = await bcrypt.hash("tester", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { password: adminPasswordHash },
    create: {
      email: "admin@example.com",
      password: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  console.log("Admin user:", admin.email);

  const tester = await prisma.user.upsert({
    where: { email: "tester@example.com" },
    update: { password: testerPasswordHash },
    create: {
      email: "tester@example.com",
      password: testerPasswordHash,
      role: UserRole.TESTER,
    },
  });

  console.log("Tester user:", tester.email);

  await prisma.currency.upsert({
    where: { code: "CZK" },
    update: {},
    create: {
      id: 1,
      code: "CZK",
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "cart_add_ui_double_call" },
    update: {
      name: "UI: Dvojité přidání do košíku",
      description:
        "Jedním klikem se v UI zavolá endpoint pro přidání do košíku 2x (mutace na úrovni UI).",
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "cart_add_ui_double_call",
      name: "UI: Dvojité přidání do košíku",
      description:
        "Jedním klikem se v UI zavolá endpoint pro přidání do košíku 2x (mutace na úrovni UI).",
      level: FaultLevel.UI,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "cart_add_api_double_quantity_payload" },
    update: {
      name: "API: Dvojnásobná payload delta pro košík",
      description:
        "API vrstva při přidání do košíku zdvojnásobí změnu množství oproti aktuálnímu košíku (mutace na úrovni API).",
      level: FaultLevel.API,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "cart_add_api_double_quantity_payload",
      name: "API: Dvojnásobná payload delta pro košík",
      description:
        "API vrstva při přidání do košíku zdvojnásobí změnu množství oproti aktuálnímu košíku (mutace na úrovni API).",
      level: FaultLevel.API,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "cart_add_unit_double_quantity_persist" },
    update: {
      name: "Backend/DB: Dvojnásobná delta uložená do košíku",
      description:
        "Backend/DB při přidání do košíku uloží dvojnásobnou změnu množství oproti aktuálnímu košíku (mutace na úrovni backend/DB).",
      level: FaultLevel.Unit,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "cart_add_unit_double_quantity_persist",
      name: "Backend/DB: Dvojnásobná delta uložená do košíku",
      description:
        "Backend/DB při přidání do košíku uloží dvojnásobnou změnu množství oproti aktuálnímu košíku (mutace na úrovni backend/DB).",
      level: FaultLevel.Unit,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  const productsData = [
    {
      name: "Testovací myš",
      description: "Jednoduchá myš pro testovací účely.",
      priceCents: 499,
      inStock: 15,
    },
    {
      name: "Testovací klávesnice",
      description: "Klávesnice pro psaní testů a bug reportů.",
      priceCents: 1299,
      inStock: 8,
    },
    {
      name: "Monitor QA",
      description: "Monitor pro sledování test reportů a dashboardů.",
      priceCents: 3999,
      inStock: 5,
    },
  ];

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();

  for (const p of productsData) {
    const product = await prisma.product.create({
      data: { ...p, currencyId: 1 },
    });
    console.log("Product:", product.name);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

