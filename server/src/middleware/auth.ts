import { type Request, type Response, type NextFunction } from "express";
import { prisma } from "../prisma.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function extractToken(req: Request): string | null {
  // 1. Cookie
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/session_token=([^;]+)/);
    if (match) return match[1];
  }

  // 2. Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: "Missing session token" });
    return;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  });

  if (!session) {
    res.status(401).json({ error: "Invalid session token" });
    return;
  }

  if (new Date() > session.expiresAt) {
    // Clean up expired session
    await prisma.session.delete({ where: { token } });
    res.status(401).json({ error: "Session expired" });
    return;
  }

  req.userId = session.userId;
  next();
}
