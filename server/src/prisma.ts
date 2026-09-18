import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Prisma 7's interactive transaction callback type strips model properties
// from the client. This alias restores them for type safety inside $transaction.
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
