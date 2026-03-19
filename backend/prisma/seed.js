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
            name: "UI: Dvojité přidání do košíku",
            description: "Jedním klikem se v UI zavolá endpoint pro přidání do košíku 2x (mutace na úrovni UI).",
            level: client_1.FaultLevel.UI,
            latencyMs: null,
            failureRate: null,
        },
        create: {
            key: "cart_add_ui_double_call",
            name: "UI: Dvojité přidání do košíku",
            description: "Jedním klikem se v UI zavolá endpoint pro přidání do košíku 2x (mutace na úrovni UI).",
            level: client_1.FaultLevel.UI,
            enabled: false,
            latencyMs: null,
            failureRate: null,
        },
    });
    await prisma.faultConfig.upsert({
        where: { key: "cart_add_api_double_quantity_payload" },
        update: {
            name: "API: Dvojnásobná payload delta pro košík",
            description: "API vrstva při přidání do košíku zdvojnásobí změnu množství oproti aktuálnímu košíku (mutace na úrovni API).",
            level: client_1.FaultLevel.API,
            latencyMs: null,
            failureRate: null,
        },
        create: {
            key: "cart_add_api_double_quantity_payload",
            name: "API: Dvojnásobná payload delta pro košík",
            description: "API vrstva při přidání do košíku zdvojnásobí změnu množství oproti aktuálnímu košíku (mutace na úrovni API).",
            level: client_1.FaultLevel.API,
            enabled: false,
            latencyMs: null,
            failureRate: null,
        },
    });
    await prisma.faultConfig.upsert({
        where: { key: "cart_add_unit_double_quantity_persist" },
        update: {
            name: "Backend/DB: Dvojnásobná delta uložená do košíku",
            description: "Backend/DB při přidání do košíku uloží dvojnásobnou změnu množství oproti aktuálnímu košíku (mutace na úrovni backend/DB).",
            level: client_1.FaultLevel.Unit,
            latencyMs: null,
            failureRate: null,
        },
        create: {
            key: "cart_add_unit_double_quantity_persist",
            name: "Backend/DB: Dvojnásobná delta uložená do košíku",
            description: "Backend/DB při přidání do košíku uloží dvojnásobnou změnu množství oproti aktuálnímu košíku (mutace na úrovni backend/DB).",
            level: client_1.FaultLevel.Unit,
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
//# sourceMappingURL=seed.js.map