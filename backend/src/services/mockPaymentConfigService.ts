import fs from "fs";
import path from "path";

export type MockPayOutcome = "success" | "failure" | "random";

type PaymentConfigsFile = {
  byBuyerEmail?: Record<string, string>;
};

const CONFIG_BASENAME = "PaymentConfigs.json";

function configPath(): string {
  return path.join(process.cwd(), "MockConfigs", CONFIG_BASENAME);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseOutcome(raw: string | undefined): MockPayOutcome {
  const v = raw?.trim().toLowerCase();
  if (v === "failure" || v === "random" || v === "success") {
    return v;
  }
  return "success";
}

/** Loads PaymentConfigs.json from cwd/MockConfigs/. Missing or invalid file => all successes. */
export function loadMockPaymentOutcomeForEmail(
  buyerEmail: string,
): MockPayOutcome {
  const key = normalizeEmail(buyerEmail);
  if (!key) {
    return "success";
  }

  const filePath = configPath();
  let parsed: PaymentConfigsFile;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    parsed = JSON.parse(raw) as PaymentConfigsFile;
  } catch {
    return "success";
  }

  const map = parsed.byBuyerEmail;
  if (!map || typeof map !== "object") {
    return "success";
  }

  const direct = map[key] ?? map[buyerEmail.trim()];
  if (direct !== undefined) {
    return parseOutcome(direct);
  }

  const lowerMap = Object.fromEntries(
    Object.entries(map).map(([k, v]) => [normalizeEmail(k), v]),
  ) as Record<string, string>;

  return parseOutcome(lowerMap[key]);
}
