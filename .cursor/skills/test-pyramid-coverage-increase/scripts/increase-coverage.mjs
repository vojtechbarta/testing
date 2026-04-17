#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "agents-results", "test-pyramid-coverage-report.md");
const STATE_PATH = path.join(ROOT, "agents-results", "test-pyramid-coverage-increase-state.json");
const LOG_PATH = path.join(ROOT, "agents-results", "test-pyramid-coverage-increase-log.md");
const BATCH_MIN = 4;
const BATCH_MAX = 8;

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    propose: args.has("--propose"),
    approve: args.has("--approve"),
    reject: args.has("--reject"),
    status: args.has("--status"),
  };
}

async function ensureAgentsResultsDir() {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
}

async function readText(filePath, fallback = "") {
  if (!existsSync(filePath)) return fallback;
  return readFile(filePath, "utf-8");
}

async function readState() {
  if (!existsSync(STATE_PATH)) {
    return {
      version: 1,
      iteration: 0,
      approvedProposalIds: [],
      currentProposal: null,
      lastReportGenerated: null,
    };
  }
  return JSON.parse(await readFile(STATE_PATH, "utf-8"));
}

async function writeState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseReport(report) {
  const generatedMatch = report.match(/^Generated:\s*(.+)$/m);
  const generated = generatedMatch ? generatedMatch[1].trim() : "unknown";

  const items = [];

  const unitWarnMatch = report.match(/### Warning: ([^\n]+) coverage below target/);
  if (unitWarnMatch) {
    const unitLine = report.match(/- line: ([0-9.]+)%/);
    const branchLine = report.match(/- branch: ([0-9.]+)%/);
    const fnLine = report.match(/- function: ([0-9.]+)%/);
    const title = `Unit coverage below target: ${unitWarnMatch[1]}`;
    items.push({
      id: `unit-${slug(unitWarnMatch[1])}`,
      level: "unit",
      title,
      detail: {
        linePct: unitLine?.[1] ?? null,
        branchPct: branchLine?.[1] ?? null,
        functionPct: fnLine?.[1] ?? null,
      },
      suggestions: [
        {
          file: "backend/src/services/unit-tests/checkoutService.test.ts",
          scenario: "Add branch-focused invalid buyer combinations via it.each.",
          assertion: "Throws validation errors and avoids side effects.",
          type: "error/branch",
        },
        {
          file: "backend/src/services/unit-tests/checkoutService.test.ts",
          scenario: "Gateway init validation edge cases for missing fields.",
          assertion: "Rejects invalid data with stable error contract.",
          type: "validation/branch",
        },
        {
          file: "backend/src/services/unit-tests/orderService.test.ts",
          scenario: "Introduce first direct unit tests for order service logic.",
          assertion: "Covers not-found and unhappy branches.",
          type: "module-coverage",
        },
      ],
    });
  }

  const integrationWarnings = [
    ...report.matchAll(/### Warning: Missing integration coverage for ([A-Z]+ [^\n]+)/g),
  ];
  for (const warning of integrationWarnings) {
    const endpoint = warning[1];
    const authNeeded = endpoint.includes("/admin/");
    const [method] = endpoint.split(" ");
    const routeParam = endpoint.includes(":");
    const suggestions = [
      {
        file: "backend/src/integration-tests/internalApi.integration.test.ts",
        scenario: `${endpoint} positive flow`,
        assertion: `Asserts ${method} success response shape and status.`,
        type: "positive",
      },
      {
        file: "backend/src/integration-tests/internalApi.integration.test.ts",
        scenario: `${endpoint} validation/error flow`,
        assertion: "Asserts 4xx status and error message contract.",
        type: "error",
      },
    ];
    if (authNeeded) {
      suggestions.push({
        file: "backend/src/integration-tests/internalApi.integration.test.ts",
        scenario: `${endpoint} unauthorized flow`,
        assertion: "Asserts 401 without token and 403 for insufficient role.",
        type: "unauthorized",
      });
    }
    if (routeParam) {
      suggestions.push({
        file: "backend/src/integration-tests/internalApi.integration.test.ts",
        scenario: `${endpoint} invalid route param`,
        assertion: "Asserts invalid id/key route param returns expected 4xx.",
        type: "route-param",
      });
    }
    items.push({
      id: `api-${slug(endpoint)}`,
      level: "integration",
      title: `Missing integration coverage for ${endpoint}`,
      detail: { endpoint },
      suggestions,
    });
  }

  const uiWarning = report.match(/## UI Coverage[\s\S]*?### Warning: ([^\n]+)/);
  if (uiWarning) {
    items.push({
      id: `ui-${slug(uiWarning[1])}`,
      level: "ui",
      title: `UI flow warning: ${uiWarning[1]}`,
      detail: {},
      suggestions: [
        {
          file: "frontend/e2e/tests/checkout-errors.spec.ts",
          scenario: "Checkout invalid form shows inline validation errors.",
          assertion: "Validation is visible and submit is blocked.",
          type: "validation",
        },
        {
          file: "frontend/e2e/tests/checkout-errors.spec.ts",
          scenario: "Checkout failure state allows user retry.",
          assertion: "Error UI appears and cart state remains intact.",
          type: "error/retry",
        },
      ],
    });
  }

  return { generated, items };
}

function priority(level) {
  if (level === "unit") return 1;
  if (level === "integration") return 2;
  return 3;
}

function buildBatch(items, approvedProposalIds) {
  const approved = new Set(approvedProposalIds);
  const sorted = [...items].sort((a, b) => priority(a.level) - priority(b.level));
  const picked = [];
  for (const item of sorted) {
    for (const suggestion of item.suggestions) {
      const proposalId = `${item.id}-${slug(suggestion.scenario)}`;
      if (approved.has(proposalId)) {
        continue;
      }
      picked.push({
        proposalId,
        level: item.level,
        warningTitle: item.title,
        ...suggestion,
      });
      if (picked.length >= BATCH_MAX) return picked;
    }
  }
  return picked.slice(0, Math.max(BATCH_MIN, Math.min(BATCH_MAX, picked.length)));
}

function formatProposal(state, reportGenerated, batch) {
  const lines = [];
  lines.push(`# Coverage Increase Proposal - Iteration ${state.iteration}`);
  lines.push("");
  lines.push(`Report timestamp: ${reportGenerated}`);
  lines.push(`Batch size: ${batch.length}`);
  lines.push("");
  for (const [index, row] of batch.entries()) {
    lines.push(`${index + 1}. [${row.level}] ${row.scenario}`);
    lines.push(`   - Warning: ${row.warningTitle}`);
    lines.push(`   - Target file: \`${row.file}\``);
    lines.push(`   - Type: ${row.type}`);
    lines.push(`   - Expected assertion: ${row.assertion}`);
  }
  return lines.join("\n");
}

async function appendLog(section) {
  const prior = await readText(LOG_PATH, "# Test Pyramid Coverage Increase Log\n\n");
  const next = `${prior}${section}\n`;
  await writeFile(LOG_PATH, next, "utf-8");
}

async function propose(state) {
  if (state.currentProposal && !state.currentProposal.approved) {
    process.stdout.write(
      `Pending unapproved proposal ${state.currentProposal.id}. Approve with --approve or reject with --reject.\n`,
    );
    return;
  }

  const report = await readText(REPORT_PATH);
  if (!report) throw new Error(`Coverage report missing at ${REPORT_PATH}`);
  const parsed = parseReport(report);
  const batch = buildBatch(parsed.items, state.approvedProposalIds ?? []);
  if (batch.length === 0) {
    process.stdout.write("No warning-derived tests to propose. Targets may already be met.\n");
    return;
  }

  state.iteration += 1;
  state.lastReportGenerated = parsed.generated;
  state.currentProposal = {
    id: `iter-${state.iteration}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    approved: false,
    batch,
    markdown: formatProposal(state, parsed.generated, batch),
  };
  await writeState(state);

  await appendLog(
    [
      `## ${new Date().toISOString()} - Proposal ${state.currentProposal.id}`,
      "",
      state.currentProposal.markdown,
      "",
      "Status: waiting for approval (`--approve`).",
      "",
    ].join("\n"),
  );

  process.stdout.write(`${state.currentProposal.markdown}\n\n`);
  process.stdout.write("Approval required: run with --approve after user confirmation.\n");
}

async function approve(state) {
  if (!state.currentProposal) {
    process.stdout.write("No proposal found. Run with --propose first.\n");
    return;
  }
  if (state.currentProposal.approved) {
    process.stdout.write(`Proposal ${state.currentProposal.id} already approved.\n`);
    return;
  }

  state.currentProposal.approved = true;
  state.currentProposal.approvedAt = new Date().toISOString();
  for (const row of state.currentProposal.batch) {
    state.approvedProposalIds.push(row.proposalId);
  }
  await writeState(state);

  await appendLog(
    [
      `## ${new Date().toISOString()} - Approved ${state.currentProposal.id}`,
      "",
      `Approved tests: ${state.currentProposal.batch.length}`,
      "",
      "Next step: implement approved tests, rerun evaluator, then run --propose again.",
      "",
    ].join("\n"),
  );

  process.stdout.write(`Approved proposal ${state.currentProposal.id}.\n`);
}

async function reject(state) {
  if (!state.currentProposal) {
    process.stdout.write("No proposal found. Nothing to reject.\n");
    return;
  }
  if (state.currentProposal.approved) {
    process.stdout.write(`Proposal ${state.currentProposal.id} is already approved and cannot be rejected.\n`);
    return;
  }

  await appendLog(
    [
      `## ${new Date().toISOString()} - Rejected ${state.currentProposal.id}`,
      "",
      "Status: rejected by user/agent request.",
      "",
    ].join("\n"),
  );

  state.currentProposal = null;
  await writeState(state);
  process.stdout.write("Proposal rejected and cleared. Run --propose to generate a new batch.\n");
}

async function status(state) {
  process.stdout.write(`Iteration: ${state.iteration}\n`);
  process.stdout.write(`Last report: ${state.lastReportGenerated ?? "n/a"}\n`);
  if (!state.currentProposal) {
    process.stdout.write("Current proposal: none\n");
    return;
  }
  process.stdout.write(`Current proposal: ${state.currentProposal.id}\n`);
  process.stdout.write(`Approved: ${state.currentProposal.approved ? "yes" : "no"}\n`);
  process.stdout.write(`Batch size: ${state.currentProposal.batch.length}\n`);
}

async function main() {
  await ensureAgentsResultsDir();
  const args = parseArgs();
  const state = await readState();

  if (args.propose) {
    await propose(state);
    return;
  }
  if (args.approve) {
    await approve(state);
    return;
  }
  if (args.reject) {
    await reject(state);
    return;
  }
  if (args.status) {
    await status(state);
    return;
  }
  process.stdout.write("Usage: --propose | --approve | --status\n");
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
