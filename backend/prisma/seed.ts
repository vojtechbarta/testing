import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password: "admin123", // pouze pro testovací účely
      role: UserRole.ADMIN,
    },
  });

  console.log("Admin user:", admin.email);

  const tester = await prisma.user.upsert({
    where: { email: "tester@example.com" },
    update: {},
    create: {
      email: "tester@example.com",
      password: "tester", // pouze pro testovací účely
      role: UserRole.TESTER,
    },
  });

  console.log("Tester user:", tester.email);

  const productsData = [
    {
      name: "Testovací myš",
      description: "Jednoduchá myš pro testovací účely.",
      priceCents: 49900,
      inStock: 15,
    },
    {
      name: "Testovací klávesnice",
      description: "Klávesnice pro psaní testů a bug reportů.",
      priceCents: 129900,
      inStock: 8,
    },
    {
      name: "Monitor QA",
      description: "Monitor pro sledování test reportů a dashboardů.",
      priceCents: 399900,
      inStock: 5,
    },
  ];

  for (const p of productsData) {
    const product = await prisma.product.create({
      data: p,
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

