import fs from "node:fs/promises";
import path from "node:path";
import { openApiSpec } from "./openapi";

async function main() {
  const outPath = path.resolve(__dirname, "..", "..", "openapi.json");
  await fs.writeFile(outPath, JSON.stringify(openApiSpec, null, 2), "utf8");
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec exported to ${outPath}`);
}

void main();
