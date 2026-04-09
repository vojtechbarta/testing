import "dotenv/config";
import { createApp } from "./app";

const app = createApp();
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);
});
