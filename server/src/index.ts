import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import authRoutes from "./routes/auth.js";
import licenseRoutes from "./routes/license.js";
import paymentRoutes from "./routes/payment.js";
import adminRoutes from "./routes/admin.js";

const app = express();
const port = process.env.PORT ?? 3000;

// ── BetterAuth handler (must come before express.json()) ─────────────────
// Express v5 requires named wildcard: {*any} instead of *
app.all("/api/auth/{*any}", toNodeHandler(auth));

// ── Body parsing ────────────────────────────────────────────────────────
app.use(express.json());

// ── CORS (tighten for production) ───────────────────────────────────────
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// ── Routes ──────────────────────────────────────────────────────────────
app.use(authRoutes);      // POST /auth/google
app.use(licenseRoutes);   // GET /license/status, POST /license/log-fill
app.use(paymentRoutes);   // POST /payment/submit
app.use(adminRoutes);     // POST /admin/payment/:id/approve|reject

// ── Health check ────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
