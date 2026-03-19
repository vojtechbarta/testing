import { Router } from "express";
import prisma from "../db/prisma";
import { getAdminSecret } from "../middleware/adminAuth";

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

    if (username !== "admin" || password !== "admin") {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const adminUser = await prisma.user.findFirst({
      where: { email: "admin@example.com" },
    });

    if (!adminUser) {
      res
        .status(500)
        .json({ message: "Admin user is not seeded in the database" });
      return;
    }

    const token = getAdminSecret();

    res.json({
      token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

