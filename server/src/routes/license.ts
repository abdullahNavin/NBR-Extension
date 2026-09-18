import { Router, type Request, type Response } from "express";
import { prisma, type TxClient } from "../prisma.js";
import { requireSession } from "../middleware/auth.js";

const router = Router();

// All license routes require authentication
router.use(requireSession);

// ── GET /license/status ─────────────────────────────────────────────────
router.get("/license/status", async (req: Request, res: Response) => {
  try {
    const license = await prisma.license.findUnique({
      where: { userId: req.userId! },
      select: { status: true, filesUsed: true, filesLimit: true },
    });

    if (!license) {
      res.status(404).json({ error: "License not found" });
      return;
    }

    res.json(license);
  } catch (err) {
    console.error("[GET /license/status]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /license/log-fill ──────────────────────────────────────────────
router.post("/license/log-fill", async (req: Request, res: Response) => {
  try {
    const { psrId } = req.body;

    if (!psrId || typeof psrId !== "string") {
      res.status(400).json({ error: "psrId is required" });
      return;
    }

    // Serializable transaction prevents two concurrent requests from both
    // slipping through the trial limit. If both read the same row and try to
    // increment, PostgreSQL will abort one with a serialization error.
    const result = await prisma.$transaction(
      async (tx: TxClient) => {
        const license = await tx.license.findUnique({
          where: { userId: req.userId! },
        });

        if (!license) {
          return { error: "license_not_found" as const };
        }

        // ── Active: always allowed ──
        if (license.status === "active") {
          return { allowed: true as const };
        }

        // ── Expired / revoked: always denied ──
        if (license.status === "expired" || license.status === "revoked") {
          return { allowed: false as const, reason: license.status };
        }

        // ── Trial logic ──
        if (license.status !== "trial") {
          return { allowed: false as const, reason: license.status };
        }

        // Already counted → don't double-charge
        if (license.usedPsrIds.includes(psrId)) {
          return { allowed: true as const };
        }

        // Exhausted
        if (license.filesUsed >= license.filesLimit) {
          return { allowed: false as const, reason: "trial_exhausted" };
        }

        // Increment
        const newUsed = license.filesUsed + 1;
        await tx.license.update({
          where: { userId: req.userId! },
          data: {
            filesUsed: newUsed,
            usedPsrIds: { push: psrId },
          },
        });

        return { allowed: true as const, filesUsed: newUsed };
      },
      { isolationLevel: "Serializable" }
    );

    if ("error" in result) {
      res.status(404).json({ error: result.error });
      return;
    }

    if (!result.allowed) {
      res.status(403).json({ allowed: false, reason: result.reason });
      return;
    }

    res.json({ allowed: true, ...("filesUsed" in result ? { filesUsed: result.filesUsed } : {}) });
  } catch (err) {
    console.error("[POST /license/log-fill]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
