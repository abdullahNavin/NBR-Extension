import { Router, type Request, type Response } from "express";
import { Prisma, PaymentMethod } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireSession } from "../middleware/auth.js";

const router = Router();

router.use(requireSession);

// ── POST /payment/submit ────────────────────────────────────────────────
router.post("/submit", async (req: Request, res: Response) => {
  try {
    const { method, senderNumber, transactionId, amount } = req.body;

    // ── Validate inputs ──
    const errors: string[] = [];
    if (!method || !Object.values(PaymentMethod).includes(method)) {
      errors.push(`method must be one of: ${Object.values(PaymentMethod).join(", ")}`);
    }
    if (!senderNumber || typeof senderNumber !== "string") {
      errors.push("senderNumber is required");
    }
    if (!transactionId || typeof transactionId !== "string") {
      errors.push("transactionId is required");
    }
    if (!amount || typeof amount !== "number" || amount <= 0) {
      errors.push("amount must be a positive number");
    }

    if (errors.length > 0) {
      res.status(400).json({ error: errors.join("; ") });
      return;
    }

    const payment = await prisma.payment.create({
      data: {
        userId: req.userId!,
        method,
        senderNumber,
        transactionId,
        amount,
        status: "pending",
      },
    });

    res.status(201).json({
      id: payment.id,
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      createdAt: payment.createdAt,
    });
  } catch (err: unknown) {
    // Unique constraint violation on transactionId
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      res.status(409).json({
        error: "A payment with this transaction ID already exists",
        field: "transactionId",
      });
      return;
    }

    console.error("[POST /payment/submit]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
