import { FaultLevel, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import { CZECH_PRODUCT_DESC_BY_ID, CZECH_PRODUCT_NAME_BY_ID } from "../src/shop/czechProductCopy";

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

  await prisma.exchangeRate.deleteMany();

  await prisma.exchangeRate.upsert({
    where: {
      exrate_src_day_pair_uq: {
        source: "MANUAL_SEED",
        effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
        fromCurrencyId: eurRow.id,
        toCurrencyId: czkRow.id,
      },
    },
    update: { sourceAmount: 1, exchangeRate: 24 },
    create: {
      source: "MANUAL_SEED",
      effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
      sourceAmount: 1,
      fromCurrencyId: eurRow.id,
      toCurrencyId: czkRow.id,
      exchangeRate: 24,
    },
  });

  // Clean up legacy/unused fault keys that should not appear in Admin → Fault injection.
  await prisma.faultConfig.deleteMany({
    where: { key: { in: ["inject_error_network_every_minute", "networ_inject_api_fail_every minute"] } },
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
    where: { key: "console_error_every_minute" },
    update: {
      name: "UI: Console error every minute",
      description:
        'Logs a console error every 60 seconds ("toto je error" / "this is error") to verify testers watch DevTools Console.',
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "console_error_every_minute",
      name: "UI: Console error every minute",
      description:
        'Logs a console error every 60 seconds ("toto je error" / "this is error") to verify testers watch DevTools Console.',
      level: FaultLevel.UI,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "network_inject_api_fail_every minute" },
    update: {
      name: "UI/API: Inject error network call every minute",
      description:
        'Triggers GET /faults/inject-error every 60 seconds from frontend when enabled; endpoint responds 400 with localized message ("tohle je bug" / "this is bug").',
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "network_inject_api_fail_every minute",
      name: "UI/API: Inject error network call every minute",
      description:
        'Triggers GET /faults/inject-error every 60 seconds from frontend when enabled; endpoint responds 400 with localized message ("tohle je bug" / "this is bug").',
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
      name: "API: Price sort – swap last two items",
      description:
        "When sorting by Price (low to high) the last two products silently swap their positions.",
      level: FaultLevel.API,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "sort_price_asc_swap_last_two",
      name: "API: Price sort – swap last two items",
      description:
        "When sorting by Price (low to high) the last two products silently swap their positions.",
      level: FaultLevel.API,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "sort_name_desc_swap_last_two" },
    update: {
      name: "API: Name Z-A sort – swap last two items",
      description:
        "When sorting by Name (Z-A) the last two products silently swap their positions.",
      level: FaultLevel.API,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "sort_name_desc_swap_last_two",
      name: "API: Name Z-A sort – swap last two items",
      description:
        "When sorting by Name (Z-A) the last two products silently swap their positions.",
      level: FaultLevel.API,
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

  await prisma.faultConfig.upsert({
    where: { key: "export_products_ui_ignore_sort_name_asc" },
    update: {
      name: "UI: Export products ignores active sorting",
      description:
        "Product CSV/PDF export ignores current catalog sort and always exports products in Name (A-Z) order.",
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "export_products_ui_ignore_sort_name_asc",
      name: "UI: Export products ignores active sorting",
      description:
        "Product CSV/PDF export ignores current catalog sort and always exports products in Name (A-Z) order.",
      level: FaultLevel.UI,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "export_products_ui_omit_middle_item" },
    update: {
      name: "UI: Export products omits one middle item",
      description:
        "Product CSV/PDF export silently skips one product from the middle of the exported list.",
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "export_products_ui_omit_middle_item",
      name: "UI: Export products omits one middle item",
      description:
        "Product CSV/PDF export silently skips one product from the middle of the exported list.",
      level: FaultLevel.UI,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "export_cart_ui_swap_currency_label" },
    update: {
      name: "UI: Export cart swaps EUR/CZK labels",
      description:
        "Cart CSV/PDF export swaps EUR and CZK currency labels while keeping numeric amounts unchanged.",
      level: FaultLevel.UI,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "export_cart_ui_swap_currency_label",
      name: "UI: Export cart swaps EUR/CZK labels",
      description:
        "Cart CSV/PDF export swaps EUR and CZK currency labels while keeping numeric amounts unchanged.",
      level: FaultLevel.UI,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "products_api_odd_minute_wait_to_even" },
    update: {
      name: "API: Products odd-minute delay to next even minute",
      description:
        "On GET /products, odd-minute requests wait until next even minute.",
      level: FaultLevel.API,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "products_api_odd_minute_wait_to_even",
      name: "API: Products odd-minute delay to next even minute",
      description:
        "On GET /products, odd-minute requests wait until next even minute.",
      level: FaultLevel.API,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "discount_more_is_less_boundary_4" },
    update: {
      name: "API: MoreIsLess discount — boundary off-by-one at 4 items",
      description:
        "Volume code MoreIsLess: exactly 4 units in cart still yields 15% instead of 20%; 5+ yields 20%.",
      level: FaultLevel.API,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "discount_more_is_less_boundary_4",
      name: "API: MoreIsLess discount — boundary off-by-one at 4 items",
      description:
        "Volume code MoreIsLess: exactly 4 units in cart still yields 15% instead of 20%; 5+ yields 20%.",
      level: FaultLevel.API,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "discount_more_is_less_empty_at_10" },
    update: {
      name: "API: MoreIsLess discount — toxic partition at 10 items",
      description:
        "Volume code MoreIsLess: exactly 10 units yields 0% discount; other counts follow normal tiers.",
      level: FaultLevel.API,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "discount_more_is_less_empty_at_10",
      name: "API: MoreIsLess discount — toxic partition at 10 items",
      description:
        "Volume code MoreIsLess: exactly 10 units yields 0% discount; other counts follow normal tiers.",
      level: FaultLevel.API,
      enabled: false,
      latencyMs: null,
      failureRate: null,
    },
  });

  await prisma.faultConfig.upsert({
    where: { key: "discount_more_is_less_tier_20_plus_50pct" },
    update: {
      name: "API: MoreIsLess discount — bogus 50% tier at 20+ items",
      description:
        "Volume code MoreIsLess: 20 or more units yields 50% off (incorrect extra tier vs spec).",
      level: FaultLevel.API,
      latencyMs: null,
      failureRate: null,
    },
    create: {
      key: "discount_more_is_less_tier_20_plus_50pct",
      name: "API: MoreIsLess discount — bogus 50% tier at 20+ items",
      description:
        "Volume code MoreIsLess: 20 or more units yields 50% off (incorrect extra tier vs spec).",
      level: FaultLevel.API,
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
      price: 17,
      inStock: 10,
    },
    {
      id: 2,
      name: "Mechanical Keyboard K87",
      description: "Compact mechanical keyboard with tactile switches.",
      price: 75,
      inStock: 10,
    },
    {
      id: 3,
      name: "27in QHD Monitor",
      description: "Crisp 1440p monitor suitable for work and media.",
      price: 208,
      inStock: 10,
    },
    {
      id: 4,
      name: "USB-C Docking Station",
      description: "Dock with HDMI, Ethernet, and USB ports for laptops.",
      price: 70,
      inStock: 10,
    },
    {
      id: 5,
      name: "Noise Cancelling Headphones",
      description: "Over-ear headphones with active noise cancellation.",
      price: 104,
      inStock: 10,
    },
    {
      id: 6,
      name: "1080p Webcam",
      description: "Full HD webcam with built-in dual microphones.",
      price: 37,
      inStock: 10,
    },
    {
      id: 7,
      name: "Gaming Mouse Pad XL",
      description: "Large desk mat with smooth tracking surface.",
      price: 15,
      inStock: 10,
    },
    {
      id: 8,
      name: "External SSD 1TB",
      description: "Portable high-speed SSD with USB 3.2 support.",
      price: 79,
      inStock: 10,
    },
    {
      id: 9,
      name: "USB-C Charger 65W",
      description: "Fast GaN charger compatible with phones and laptops.",
      price: 29,
      inStock: 10,
    },
    {
      id: 10,
      name: "Laptop Stand Aluminum",
      description: "Ergonomic stand improving airflow and posture.",
      price: 21,
      inStock: 10,
    },
    {
      id: 11,
      name: "Bluetooth Speaker Mini",
      description: "Portable speaker with balanced sound and deep bass.",
      price: 50,
      inStock: 10,
    },
    {
      id: 12,
      name: "Smart LED Desk Lamp",
      description: "Dimmable desk lamp with adjustable color temperature.",
      price: 29,
      inStock: 10,
    },
    {
      id: 13,
      name: "Office Chair Ergo",
      description: "Comfortable ergonomic chair with lumbar support.",
      price: 208,
      inStock: 10,
    },
    {
      id: 14,
      name: "Full HD Projector",
      description: "Home and office projector with HDMI connectivity.",
      price: 500,
      inStock: 10,
    },
    {
      id: 15,
      name: "Wi-Fi Router AX3000",
      description: "Dual-band router with stable high-speed performance.",
      price: 62,
      inStock: 10,
    },
  ];

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();

  for (const p of productsData) {
    const product = await prisma.product.create({
      data: { ...p, currencyId: eurRow.id },
    });
    console.log("Product:", product.name, "id=", product.id);
  }

  for (const p of productsData) {
    const translatedName = CZECH_PRODUCT_NAME_BY_ID[p.id];
    const translatedDescription = CZECH_PRODUCT_DESC_BY_ID[p.id];
    if (!translatedName || !translatedDescription) {
      continue;
    }
    await prisma.productTranslation.upsert({
      where: { product_locale_unique: { productId: p.id, locale: "cs" } },
      update: { name: translatedName, description: translatedDescription },
      create: {
        productId: p.id,
        locale: "cs",
        name: translatedName,
        description: translatedDescription,
      },
    });
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

