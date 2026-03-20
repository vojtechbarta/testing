import "dotenv/config";
import express from "express";
import cors from "cors";
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import cartRouter from "./routes/cart";
import authRouter from "./routes/auth";
import adminProductsRouter from "./routes/adminProducts";
import adminFaultsRouter from "./routes/adminFaults";
import uiFaultsRouter from "./routes/uiFaults";
import checkoutRouter from "./routes/checkout";

const app = express();
const port = process.env.PORT || 4000;

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/products", productsRouter);
app.use("/orders", ordersRouter);
app.use("/checkout", checkoutRouter);
app.use("/cart", cartRouter);
app.use("/admin/products", adminProductsRouter);
app.use("/admin/faults", adminFaultsRouter);
app.use("/faults", uiFaultsRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = err instanceof Error ? err.message : "Internal error";
    const clientIssue =
      /required|empty|not found|Insufficient|not available|cannot be processed|no longer awaiting|not using/i.test(
        message,
      );
    res.status(clientIssue ? 400 : 500).json({ message });
  },
);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);
});


