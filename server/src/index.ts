import 'dotenv/config';
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import authRoutes from "./routes/auth.js";
import licenseRoutes from "./routes/license.js";
import paymentRoutes from "./routes/payment.js";
import adminRoutes from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT ?? 3000;

// ── Static files (purchase page etc.) ───────────────────────────────────
app.get("/purchase", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/purchase.html"));
});
app.use(express.static(path.join(__dirname, "../public")));

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

// ── Routes (mounted at specific prefixes so auth middleware doesn't
//    intercept static-file requests like /purchase) ─────────────────────
app.use("/auth", authRoutes);          // POST /auth/google
app.use("/license", licenseRoutes);    // GET  /license/status, POST /license/log-fill
app.use("/payment", paymentRoutes);    // POST /payment/submit
app.use("/admin", adminRoutes);        // POST /admin/payment/:id/approve|reject

// ── Health check ────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
