import type { Request, Response, NextFunction } from "express";

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? "dev-admin-secret";

export function getAdminSecret() {
  return ADMIN_JWT_SECRET;
}

export function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);
  if (token !== ADMIN_JWT_SECRET) {
    res.status(401).json({ message: "Invalid admin token" });
    return;
  }

  next();
}

