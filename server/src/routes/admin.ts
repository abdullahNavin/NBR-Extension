import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "../prisma.js";
import { requireSession } from "../middleware/auth.js";

const router = Router();

// ── Admin guard: require session + email must match ADMIN_EMAIL ─────────
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    res.status(500).json({ error: "ADMIN_EMAIL not configured" });
    return;
  }

  // req.userId is set by requireSession — we need the full user to check email.
  // We already called requireSession before this, so userId exists.
  prisma.user
    .findUnique({ where: { id: req.userId! }, select: { email: true } })
    .then((user) => {
      if (!user || user.email !== adminEmail) {
        res.status(403).json({ error: "Forbidden: not an admin" });
        return;
      }
      next();
    })
    .catch((err: unknown) => {
      console.error("[requireAdmin]", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

router.use(requireSession, requireAdmin);

// ── POST /admin/payment/:paymentId/approve ──────────────────────────────
router.post(
  "/payment/:paymentId/approve",
  async (req: Request, res: Response) => {
    try {
      const paymentId = String(req.params.paymentId);

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { id: true, status: true, userId: true },
      });

      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      if (payment.status !== "pending") {
        res.status(409).json({
          error: `Payment already ${payment.status}`,
          currentStatus: payment.status,
        });
        return;
      }

      // Mark payment verified + activate license in one transaction
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: paymentId },
          data: { status: "verified" },
        }),
        prisma.license.update({
          where: { userId: payment.userId },
          data: { status: "active", activatedAt: new Date() },
        }),
      ]);

      res.json({ ok: true, paymentId, status: "verified" });
    } catch (err: unknown) {
      console.error("[POST /admin/payment/:id/approve]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── POST /admin/payment/:paymentId/reject ───────────────────────────────
router.post(
  "/payment/:paymentId/reject",
  async (req: Request, res: Response) => {
    try {
      const paymentId = String(req.params.paymentId);

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { id: true, status: true },
      });

      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      if (payment.status !== "pending") {
        res.status(409).json({
          error: `Payment already ${payment.status}`,
          currentStatus: payment.status,
        });
        return;
      }

      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: "rejected" },
      });

      res.json({ ok: true, paymentId, status: "rejected" });
    } catch (err: unknown) {
      console.error("[POST /admin/payment/:id/reject]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
