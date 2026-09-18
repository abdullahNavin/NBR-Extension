import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh daily
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.license.create({
            data: {
              userId: user.id,
              status: "trial",
              filesLimit: 10,
              filesUsed: 0,
              usedPsrIds: [],
            },
          });
        },
      },
    },
  },
});
