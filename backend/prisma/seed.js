"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    const adminPasswordHash = await bcrypt_1.default.hash("admin", 10);
    const testerPasswordHash = await bcrypt_1.default.hash("tester", 10);
    const admin = await prisma.user.upsert({
        where: { email: "admin@example.com" },
        update: { password: adminPasswordHash },
        create: {
            email: "admin@example.com",
            password: adminPasswordHash,
            role: client_1.UserRole.ADMIN,
        },
    });
    console.log("Admin user:", admin.email);
    const tester = await prisma.user.upsert({
        where: { email: "tester@example.com" },
        update: { password: testerPasswordHash },
        create: {
            email: "tester@example.com",
            password: testerPasswordHash,
            role: client_1.UserRole.TESTER,
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
            name: "UI: Double-add to cart",
            description: "With a single click, the UI calls the cart-add endpoint twice (UI-level mutation).",
            level: client_1.FaultLevel.UI,
            latencyMs: null,
            failureRate: null,
        },
        create: {
            key: "cart_add_ui_double_call",
            name: "UI: Double-add to cart",
            description: "With a single click, the UI calls the cart-add endpoint twice (UI-level mutation).",
            level: client_1.FaultLevel.UI,
            enabled: false,
            latencyMs: null,
            failureRate: null,
        },
    });
    await prisma.faultConfig.upsert({
        where: { key: "cart_add_api_double_quantity_payload" },
        update: {
            name: "API: Doubled cart quantity delta",
            description: "The API layer doubles the quantity change compared to the current cart (API-level mutation).",
            level: client_1.FaultLevel.API,
            latencyMs: null,
            failureRate: null,
        },
        create: {
            key: "cart_add_api_double_quantity_payload",
            name: "API: Doubled cart quantity delta",
            description: "The API layer doubles the quantity change compared to the current cart (API-level mutation).",
            level: client_1.FaultLevel.API,
            enabled: false,
            latencyMs: null,
            failureRate: null,
        },
    });
    await prisma.faultConfig.upsert({
        where: { key: "cart_add_unit_double_quantity_persist" },
        update: {
            name: "Backend/DB: Doubled cart quantity delta",
            description: "The Backend/DB layer stores a doubled quantity change compared to the current cart (backend/DB-level mutation).",
            level: client_1.FaultLevel.Unit,
            latencyMs: null,
            failureRate: null,
        },
        create: {
            key: "cart_add_unit_double_quantity_persist",
            name: "Backend/DB: Doubled cart quantity delta",
            description: "The Backend/DB layer stores a doubled quantity change compared to the current cart (backend/DB-level mutation).",
            level: client_1.FaultLevel.Unit,
            enabled: false,
            latencyMs: null,
            failureRate: null,
        },
    });
    const productsData = [
        {
            name: "Test Mouse",
            description: "A simple mouse for testing purposes.",
            price: 499,
            inStock: 15,
        },
        {
            name: "Test Keyboard",
            description: "A keyboard for writing tests and bug reports.",
            price: 1299,
            inStock: 8,
        },
        {
            name: "QA Monitor",
            description: "A monitor for tracking test reports and dashboards.",
            price: 3999,
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
//# sourceMappingURL=seed.js.map