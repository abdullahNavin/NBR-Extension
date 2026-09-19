import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });

// Prisma 7's interactive transaction callback type strips model properties
// from the client. This alias restores them for type safety inside $transaction.
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
