import { Router } from "express";
import prisma from "../db/prisma";
import { signAdminToken } from "../middleware/adminAuth";
import { UserRole } from "@prisma/client";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body as {
      username: string;
      password: string;
    };

    if (!username || !password) {
      res.status(400).json({ message: "Username and password are required" });
      return;
    }

    let expectedRole: UserRole | null = null;
    let expectedEmail: string | null = null;

    if (username === "admin" && password === "admin") {
      expectedRole = UserRole.ADMIN;
      expectedEmail = "admin@example.com";
    } else if (username === "tester" && password === "tester") {
      expectedRole = UserRole.TESTER;
      expectedEmail = "tester@example.com";
    } else {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { email: expectedEmail, role: expectedRole },
    });

    if (!user) {
      res.status(500).json({ message: "User is not seeded in the database" });
      return;
    }

    const token = signAdminToken({ userId: user.id, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

