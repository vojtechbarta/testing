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

  await prisma.currency.upsert({
    where: { code: "EUR" },
    update: {},
    create: { code: "EUR" },
  });

  const czkRow = await prisma.currency.findUniqueOrThrow({
    where: { code: "CZK" },
  });
  const eurRow = await prisma.currency.findUniqueOrThrow({
    where: { code: "EUR" },
  });

  await prisma.exchangeRate.upsert({
    where: {
      fromCurrencyId_toCurrencyId: {
        fromCurrencyId: eurRow.id,
        toCurrencyId: czkRow.id,
      },
    },
    update: { exchangeRate: 24 },
    create: {
      fromCurrencyId: eurRow.id,
      toCurrencyId: czkRow.id,
      exchangeRate: 24,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "cart_add_ui_double_call" },
    update: {
      name: "UI: Double-add to cart",
      description:
        "With a single click, the UI calls the cart-add endpoint twice (UI-level mutation).",
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "cart_add_ui_double_call",
      name: "UI: Double-add to cart",
      description:
        "With a single click, the UI calls the cart-add endpoint twice (UI-level mutation).",
      level: FaultLevel.UI,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "cart_add_api_double_quantity_payload" },
    update: {
      name: "API: Doubled cart quantity delta",
      description:
        "The API layer doubles the quantity change compared to the current cart (API-level mutation).",
      level: FaultLevel.API,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "cart_add_api_double_quantity_payload",
      name: "API: Doubled cart quantity delta",
      description:
        "The API layer doubles the quantity change compared to the current cart (API-level mutation).",
      level: FaultLevel.API,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "checkout_email_wrong_language" },
    update: {
      name: "API: Checkout email in wrong language",
      description:
        "The checkout route sends the bank-transfer confirmation email in the opposite language than the selected storefront language (EN↔CS).",
      level: FaultLevel.API,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "checkout_email_wrong_language",
      name: "API: Checkout email in wrong language",
      description:
        "The checkout route sends the bank-transfer confirmation email in the opposite language than the selected storefront language (EN↔CS).",
      level: FaultLevel.API,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "cart_add_unit_double_quantity_persist" },
    update: {
      name: "Backend/DB: Doubled cart quantity delta",
      description:
        "The Backend/DB layer stores a doubled quantity change compared to the current cart (backend/DB-level mutation).",
      level: FaultLevel.Unit,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "cart_add_unit_double_quantity_persist",
      name: "Backend/DB: Doubled cart quantity delta",
      description:
        "The Backend/DB layer stores a doubled quantity change compared to the current cart (backend/DB-level mutation).",
      level: FaultLevel.Unit,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "sort_price_asc_swap_last_two" },
    update: {
      name: "UI: Price sort – swap last two items",
      description:
        "When sorting by Price (low to high) the last two products silently swap their positions.",
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "sort_price_asc_swap_last_two",
      name: "UI: Price sort – swap last two items",
      description:
        "When sorting by Price (low to high) the last two products silently swap their positions.",
      level: FaultLevel.UI,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "sort_name_desc_swap_last_two" },
    update: {
      name: "UI: Name Z-A sort – swap last two items",
      description:
        "When sorting by Name (Z-A) the last two products silently swap their positions.",
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "sort_name_desc_swap_last_two",
      name: "UI: Name Z-A sort – swap last two items",
      description:
        "When sorting by Name (Z-A) the last two products silently swap their positions.",
      level: FaultLevel.UI,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "ui_label_typos" },
    update: {
      name: "UI: Label typos",
      description:
        'Introduces typos in three UI labels: "Name (A-Z)" → "Name (A-Y)", "In Stock" → "In Sock", "Address (optional)" → "Adres (optional)".',
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "ui_label_typos",
      name: "UI: Label typos",
      description:
        'Introduces typos in three UI labels: "Name (A-Z)" → "Name (A-Y)", "In Stock" → "In Sock", "Address (optional)" → "Adres (optional)".',
      level: FaultLevel.UI,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "grid_non_chrome_broken" },
    update: {
      name: "UI: Broken product grid (non-Chrome)",
      description:
        "In any browser other than Google Chrome the product grid renders misaligned and cards partially overlap, mimicking a CSS grid compatibility bug.",
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "grid_non_chrome_broken",
      name: "UI: Broken product grid (non-Chrome)",
      description:
        "In any browser other than Google Chrome the product grid renders misaligned and cards partially overlap, mimicking a CSS grid compatibility bug.",
      level: FaultLevel.UI,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  // Stable ids 1..N so E2E `data-testid="shop-add-to-cart-${id}"` matches after every seed.
  // (MySQL AUTO_INCREMENT does not reset on `deleteMany`, so implicit ids would drift.)
  const productsData = [
    {
      id: 1,
      name: "Wireless Mouse M200",
      description: "Reliable wireless mouse for everyday office work.",
      price: 399,
      inStock: 10,
    },
    {
      id: 2,
      name: "Mechanical Keyboard K87",
      description: "Compact mechanical keyboard with tactile switches.",
      price: 1790,
      inStock: 10,
    },
    {
      id: 3,
      name: "27in QHD Monitor",
      description: "Crisp 1440p monitor suitable for work and media.",
      price: 4990,
      inStock: 10,
    },
    {
      id: 4,
      name: "USB-C Docking Station",
      description: "Dock with HDMI, Ethernet, and USB ports for laptops.",
      price: 1690,
      inStock: 10,
    },
    {
      id: 5,
      name: "Noise Cancelling Headphones",
      description: "Over-ear headphones with active noise cancellation.",
      price: 2490,
      inStock: 10,
    },
    {
      id: 6,
      name: "1080p Webcam",
      description: "Full HD webcam with built-in dual microphones.",
      price: 890,
      inStock: 10,
    },
    {
      id: 7,
      name: "Gaming Mouse Pad XL",
      description: "Large desk mat with smooth tracking surface.",
      price: 349,
      inStock: 10,
    },
    {
      id: 8,
      name: "External SSD 1TB",
      description: "Portable high-speed SSD with USB 3.2 support.",
      price: 1890,
      inStock: 10,
    },
    {
      id: 9,
      name: "USB-C Charger 65W",
      description: "Fast GaN charger compatible with phones and laptops.",
      price: 699,
      inStock: 10,
    },
    {
      id: 10,
      name: "Laptop Stand Aluminum",
      description: "Ergonomic stand improving airflow and posture.",
      price: 499,
      inStock: 10,
    },
    {
      id: 11,
      name: "Bluetooth Speaker Mini",
      description: "Portable speaker with balanced sound and deep bass.",
      price: 1190,
      inStock: 10,
    },
    {
      id: 12,
      name: "Smart LED Desk Lamp",
      description: "Dimmable desk lamp with adjustable color temperature.",
      price: 699,
      inStock: 10,
    },
    {
      id: 13,
      name: "Office Chair Ergo",
      description: "Comfortable ergonomic chair with lumbar support.",
      price: 4990,
      inStock: 10,
    },
    {
      id: 14,
      name: "Full HD Projector",
      description: "Home and office projector with HDMI connectivity.",
      price: 11990,
      inStock: 10,
    },
    {
      id: 15,
      name: "Wi-Fi Router AX3000",
      description: "Dual-band router with stable high-speed performance.",
      price: 1490,
      inStock: 10,
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
    console.log("Product:", product.name, "id=", product.id);
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

