import express from "express";
import cors from "cors";
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import cartRouter from "./routes/cart";
import authRouter from "./routes/auth";
import adminProductsRouter from "./routes/adminProducts";
import adminFaultsRouter from "./routes/adminFaults";
import uiFaultsRouter from "./routes/uiFaults";

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
app.use("/cart", cartRouter);
app.use("/admin/products", adminProductsRouter);
app.use("/admin/faults", adminFaultsRouter);
app.use("/faults", uiFaultsRouter);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);
});


