import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? "dev-admin-secret";

export function signAdminToken(payload: { userId: number; role: UserRole }) {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: "8h" });
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: UserRole;
  };
}

export function roleAuth(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const token = authHeader.slice("Bearer ".length);

    try {
      const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as {
        userId: number;
        role: UserRole;
      };

      if (!allowedRoles.includes(decoded.role)) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }

      req.user = { id: decoded.userId, role: decoded.role };
      next();
    } catch {
      res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}


