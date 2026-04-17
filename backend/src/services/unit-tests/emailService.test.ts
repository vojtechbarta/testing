import { afterEach, describe, expect, it } from "vitest";
import { isEtherealMode, isSmtpConfigured } from "../emailService";

const ENV_KEYS = [
  "SMTP_USE_ETHEREAL",
  "USE_ETHEREAL_EMAIL",
  "SMTP_HOST",
  "SMTP_FROM",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
] as const;

const ORIGINAL_ENV: Record<string, string | undefined> = Object.fromEntries(
  ENV_KEYS.map((k) => [k, process.env[k]]),
);

function resetEnv() {
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL_ENV[key];
    }
  }
}

describe("emailService smtp mode/config", () => {
  afterEach(() => {
    resetEnv();
  });

  it("detects ethereal mode from SMTP_USE_ETHEREAL", () => {
    process.env.SMTP_USE_ETHEREAL = "true";
    delete process.env.USE_ETHEREAL_EMAIL;
    expect(isEtherealMode()).toBe(true);
    expect(isSmtpConfigured()).toBe(true);
  });

  it("detects ethereal mode from legacy USE_ETHEREAL_EMAIL", () => {
    delete process.env.SMTP_USE_ETHEREAL;
    process.env.USE_ETHEREAL_EMAIL = "yes";
    expect(isEtherealMode()).toBe(true);
    expect(isSmtpConfigured()).toBe(true);
  });

  it("returns false when smtp host/from are missing", () => {
    delete process.env.SMTP_USE_ETHEREAL;
    delete process.env.USE_ETHEREAL_EMAIL;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    expect(isEtherealMode()).toBe(false);
    expect(isSmtpConfigured()).toBe(false);
  });

  it("returns true when direct SMTP host and from are present", () => {
    delete process.env.SMTP_USE_ETHEREAL;
    delete process.env.USE_ETHEREAL_EMAIL;
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_FROM = "shop@example.test";
    expect(isEtherealMode()).toBe(false);
    expect(isSmtpConfigured()).toBe(true);
  });
});
