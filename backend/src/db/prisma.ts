import { PrismaClient } from "@prisma/client";

// Prisma 7 používá konfiguraci datasource z prisma.config.ts,
// proto zde klient vytváříme bez dalších options.
const prisma = new PrismaClient();

export default prisma;



