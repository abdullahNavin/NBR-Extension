import { Router, type Request, type Response } from "express";
import { auth } from "../auth.js";
import { prisma, type TxClient } from "../prisma.js";
import crypto from "node:crypto";

const router = Router();

router.post("/auth/google", async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken || typeof accessToken !== "string") {
      res.status(400).json({ error: "accessToken is required" });
      return;
    }

    // ── 1. Verify the access token against Google ────────────────────────
    const googleRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!googleRes.ok) {
      res.status(401).json({ error: "Invalid Google access token" });
      return;
    }

    const profile = (await googleRes.json()) as {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    };

    const googleSub = profile.sub;
    const email = profile.email;

    if (!email) {
      res.status(400).json({ error: "Google account has no email" });
      return;
    }

    // ── 2. Look up existing account ──────────────────────────────────────
    let account = await prisma.account.findUnique({
      where: { providerId_accountId: { providerId: "google", accountId: googleSub } },
      include: { user: true },
    });

    let user = account?.user ?? null;

    // ── 3. Create user + account if first login ──────────────────────────
    if (!user) {
      const name = profile.name || email.split("@")[0];

      user = await prisma.$transaction(async (tx: TxClient) => {
        const newUser = await tx.user.create({
          data: {
            name,
            email,
            emailVerified: true,
            image: profile.picture ?? null,
          },
        });

        await tx.account.create({
          data: {
            providerId: "google",
            accountId: googleSub,
            userId: newUser.id,
            accessToken,
          },
        });

        return newUser;
      });
    } else {
      // Returning user – update the access token
      await prisma.account.update({
        where: { providerId_accountId: { providerId: "google", accountId: googleSub } },
        data: { accessToken },
      });
    }

    // ── 4. Ensure license exists (belt-and-suspenders with the DB hook) ──
    await prisma.license.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: "trial",
        filesLimit: 10,
        filesUsed: 0,
        usedPsrIds: [],
      },
      update: {}, // no-op if already exists
    });

    // ── 5. Create a BetterAuth session ───────────────────────────────────
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? null,
      },
    });

    // ── 6. Return token + set cookie ─────────────────────────────────────
    res.setHeader("Set-Cookie", `session_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    });
  } catch (err) {
    console.error("[POST /auth/google]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
