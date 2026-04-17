#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const BACKEND_DIR = path.join(ROOT, "backend");
const ROUTES_DIR = path.join(BACKEND_DIR, "src", "routes");
const INTEGRATION_TESTS_DIR = path.join(BACKEND_DIR, "src", "integration-tests");
const UNIT_TESTS_DIR = path.join(BACKEND_DIR, "src", "services", "unit-tests");
const SERVICES_DIR = path.join(BACKEND_DIR, "src", "services");
const UI_TESTS_DIR = path.join(ROOT, "frontend", "e2e", "tests");
const DEFAULT_OUT = path.join(ROOT, "agents-results", "test-pyramid-coverage-report.md");
const COVERAGE_JSON = path.join(BACKEND_DIR, "coverage-pyramid", "coverage-summary.json");

const TARGETS = {
  line: 95,
  function: 95,
  branch: 90,
};

function parseArgs() {
  const outIndex = process.argv.indexOf("--out");
  if (outIndex !== -1 && process.argv[outIndex + 1]) {
    return { outFile: path.resolve(ROOT, process.argv[outIndex + 1]) };
  }
  return { outFile: DEFAULT_OUT };
}

function pct(metric) {
  if (!metric || typeof metric.pct !== "number") return null;
  return metric.pct;
}

function metricStatus(name, value, target) {
  if (value == null) return `- ${name}: unavailable`;
  const status = value >= target ? "OK" : "Warning";
  return `- ${name}: ${value.toFixed(2)}% (target >= ${target}%) - ${status}`;
}

function runBackendCoverage() {
  const result = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      "src/services/unit-tests",
      "--coverage.enabled",
      "true",
      "--coverage.provider",
      "v8",
      "--coverage.reporter",
      "json-summary",
      "--coverage.reportsDirectory",
      "coverage-pyramid",
    ],
    {
      cwd: BACKEND_DIR,
      encoding: "utf-8",
      timeout: 240_000,
    },
  );

  return {
    ok: result.status === 0 && existsSync(COVERAGE_JSON),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

async function readUnitCoverage() {
  const run = runBackendCoverage();
  if (!run.ok) {
    return {
      available: false,
      reason: run.stderr.trim() || run.stdout.trim() || "coverage run failed",
      metrics: null,
    };
  }
  const raw = await readFile(COVERAGE_JSON, "utf-8");
  const summary = JSON.parse(raw);
  const total = summary.total ?? {};
  const metrics = {
    line: pct(total.lines),
    function: pct(total.functions),
    branch: pct(total.branches),
    statement: pct(total.statements),
  };
  return { available: true, reason: "", metrics };
}

async function listFiles(dir, extension) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

async function parseMounts() {
  const appPath = path.join(BACKEND_DIR, "src", "app.ts");
  const appText = await readFile(appPath, "utf-8");

  const importRegex = /import\s+(\w+)\s+from\s+"\.\/routes\/([^"]+)";/g;
  const importedRouters = new Map();
  for (const match of appText.matchAll(importRegex)) {
    importedRouters.set(match[1], match[2]);
  }

  const mountRegex = /app\.use\("([^"]+)",\s*(\w+)\);/g;
  const mounts = [];
  for (const match of appText.matchAll(mountRegex)) {
    const basePath = match[1];
    const variableName = match[2];
    const routeFileBase = importedRouters.get(variableName);
    if (routeFileBase) {
      mounts.push({ basePath, routeFileBase });
    }
  }

  const directRegex = /app\.(get|post|put|patch|delete)\("([^"]+)"/g;
  const directEndpoints = [];
  for (const match of appText.matchAll(directRegex)) {
    directEndpoints.push({
      method: match[1].toUpperCase(),
      path: match[2],
      source: "app.ts",
    });
  }
  return { mounts, directEndpoints };
}

async function parseRouteEndpoints(mounts) {
  const endpoints = [];
  for (const mount of mounts) {
    const routeFile = path.join(ROUTES_DIR, `${mount.routeFileBase}.ts`);
    if (!existsSync(routeFile)) continue;
    const content = await readFile(routeFile, "utf-8");
    const routeRegex = /router\.(get|post|put|patch|delete)\("([^"]*)"/g;
    for (const match of content.matchAll(routeRegex)) {
      const method = match[1].toUpperCase();
      const child = match[2];
      const fullPath = `${mount.basePath}${child || ""}`.replace(/\/+/g, "/");
      endpoints.push({
        method,
        path: fullPath.endsWith("/") && fullPath !== "/" ? fullPath.slice(0, -1) : fullPath,
        source: `routes/${mount.routeFileBase}.ts`,
      });
    }
  }
  return endpoints;
}

function normalizePath(rawPath) {
  return rawPath.replace(/\/+$/, "") || "/";
}

function endpointKey(method, urlPath) {
  return `${method.toUpperCase()} ${normalizePath(urlPath)}`;
}

async function readIntegrationCoverage(endpoints) {
  const files = await listFiles(INTEGRATION_TESTS_DIR, ".test.ts");
  const text = (await Promise.all(files.map((f) => readFile(f, "utf-8"))).then((parts) =>
    parts.join("\n"),
  )) || "";

  const covered = new Set();
  const byKey = new Map(endpoints.map((e) => [endpointKey(e.method, e.path), e]));

  const callRegex = /\.(get|post|put|patch|delete)\(\s*[`'"]([^`'"]+)[`'"]\s*\)/g;
  for (const match of text.matchAll(callRegex)) {
    const method = match[1].toUpperCase();
    const rawUrl = match[2];
    const url = rawUrl.replace(/\$\{[^}]+\}/g, ":id");
    const key = endpointKey(method, url);
    if (byKey.has(key)) {
      covered.add(key);
      continue;
    }
    // Try template ids for route params.
    for (const existingKey of byKey.keys()) {
      const [m, p] = existingKey.split(" ", 2);
      if (m !== method) continue;
      const routePattern = new RegExp(`^${p.replace(/:[^/]+/g, "[^/]+")}$`);
      if (routePattern.test(normalizePath(url))) {
        covered.add(existingKey);
      }
    }
  }

  return { files, covered };
}

function hasAuthRequirement(endpointPath) {
  return endpointPath.startsWith("/admin");
}

function inferMissingCategories(endpoint, covered) {
  if (covered) return [];
  const categories = ["positive flow"];
  if (endpoint.path.includes(":")) categories.push("route param");
  categories.push("validation/error flow");
  if (hasAuthRequirement(endpoint.path)) categories.push("unauthorized/forbidden");
  return categories;
}

async function analyzeUnitTestSurface() {
  const unitTests = await listFiles(UNIT_TESTS_DIR, ".test.ts");
  const services = await listFiles(SERVICES_DIR, ".ts");

  const testedModules = new Set(unitTests.map((f) => path.basename(f).replace(/\.test\.ts$/, "")));
  const serviceModules = services
    .map((f) => path.basename(f, ".ts"))
    .filter((name) => name !== "unit-tests")
    .sort();

  const missing = serviceModules.filter((module) => {
    if (module === "productService") {
      return ![...testedModules].some((name) => name.startsWith("productService"));
    }
    return !testedModules.has(module);
  });

  return { unitTests, serviceModules, missing };
}

async function analyzeUiFlows() {
  const specFiles = await listFiles(UI_TESTS_DIR, ".spec.ts");
  const analyses = [];
  let totalTests = 0;
  let independentTests = 0;
  let longFlowWarnings = 0;

  for (const specFile of specFiles) {
    const text = await readFile(specFile, "utf-8");
    const testBlocks = text.match(/test\((.|\n)*?\}\);/g) || [];
    const fileResult = { file: path.relative(ROOT, specFile), tests: testBlocks.length, warnings: [] };
    totalTests += testBlocks.length;

    for (const block of testBlocks) {
      const hasSetup = /goto\(/.test(block) || /new\s+\w+Page\(/.test(block);
      const hasLongChain = (block.match(/await\s+/g) || []).length >= 12;
      if (hasSetup) independentTests += 1;
      if (hasLongChain) {
        longFlowWarnings += 1;
        fileResult.warnings.push("Contains a long chained flow; consider splitting.");
      }
    }
    analyses.push(fileResult);
  }

  const independenceScore = totalTests === 0 ? 0 : (independentTests / totalTests) * 100;
  return { specFiles, analyses, totalTests, independentTests, independenceScore, longFlowWarnings };
}

function buildUnitSection(unitCoverage, unitSurface) {
  const lines = [];
  lines.push("## Unit Coverage");
  if (!unitCoverage.available || !unitCoverage.metrics) {
    lines.push("");
    lines.push("- Coverage run was unavailable.");
    lines.push(`- Reason: ${unitCoverage.reason}`);
    lines.push("");
    lines.push("### Warning: Unit metrics unavailable");
    lines.push("- **Missing Tests**");
    lines.push("  - Add/repair backend unit coverage command and rerun evaluator.");
    lines.push("- **Implementation Proposal**");
    lines.push("  - Install/enable Vitest coverage provider and keep json-summary output.");
    lines.push("- **Suggested File Placement**");
    lines.push("  - `backend/package.json`");
    return lines.join("\n");
  }

  const { line, function: fn, branch, statement } = unitCoverage.metrics;
  lines.push("");
  lines.push(metricStatus("line", line, TARGETS.line));
  lines.push(metricStatus("function", fn, TARGETS.function));
  lines.push(metricStatus("branch", branch, TARGETS.branch));
  lines.push(metricStatus("statement", statement, TARGETS.line));
  lines.push("");

  const warnings = [];
  if (line < TARGETS.line) warnings.push("line");
  if (fn < TARGETS.function) warnings.push("function");
  if (branch < TARGETS.branch) warnings.push("branch");

  if (warnings.length === 0) {
    lines.push("- No threshold warnings at Unit level.");
  } else {
    lines.push(`### Warning: ${warnings.join(", ")} coverage below target`);
    lines.push("- **Missing Tests**");
    if (branch < TARGETS.branch) {
      lines.push(
        "  - Add branch-focused tests for checkout/cart failure conditions and service error paths.",
      );
    }
    lines.push(
      `  - Add missing unit coverage for service modules without direct tests: ${unitSurface.missing.join(", ") || "none"}.`,
    );
    lines.push("- **Implementation Proposal**");
    lines.push("  - Add `it.each(...)` variants for invalid inputs and not-found branches.");
    lines.push("  - Mock Prisma side effects and assert both thrown error and unchanged persisted state.");
    lines.push("- **Suggested File Placement**");
    lines.push("  - `backend/src/services/unit-tests/*.test.ts`");
  }
  return lines.join("\n");
}

function buildIntegrationSection(endpoints, coverageSet) {
  const lines = [];
  lines.push("## Integration/API Coverage");
  lines.push("");
  lines.push("| Endpoint | Covered |");
  lines.push("|---|---|");

  const uncovered = [];
  for (const endpoint of endpoints) {
    const key = endpointKey(endpoint.method, endpoint.path);
    const isCovered = coverageSet.has(key);
    lines.push(`| \`${key}\` | ${isCovered ? "Yes" : "No"} |`);
    if (!isCovered) uncovered.push(endpoint);
  }

  lines.push("");
  if (uncovered.length === 0) {
    lines.push("- No endpoint presence gaps detected in integration tests.");
    return lines.join("\n");
  }

  for (const endpoint of uncovered) {
    const key = endpointKey(endpoint.method, endpoint.path);
    const categories = inferMissingCategories(endpoint, false);
    lines.push(`### Warning: Missing integration coverage for ${key}`);
    lines.push("- **Missing Tests**");
    for (const category of categories) {
      lines.push(`  - ${category}`);
    }
    lines.push("- **Implementation Proposal**");
    lines.push(
      `  - Add a focused integration test block for \`${key}\` with positive + error assertions and contract checks.`,
    );
    if (hasAuthRequirement(endpoint.path)) {
      lines.push("  - Include explicit 401 (no token) and 403 (insufficient role) checks.");
    }
    lines.push("- **Suggested File Placement**");
    lines.push("  - `backend/src/integration-tests/internalApi.integration.test.ts`");
    lines.push("");
  }

  return lines.join("\n");
}

function buildUiSection(ui) {
  const lines = [];
  lines.push("## UI Coverage");
  lines.push("");
  lines.push(`- Spec files: ${ui.specFiles.length}`);
  lines.push(`- Total tests: ${ui.totalTests}`);
  lines.push(`- Independent setup signals: ${ui.independentTests}/${ui.totalTests}`);
  lines.push(`- Independence score: ${ui.independenceScore.toFixed(2)}%`);
  lines.push("");

  const warnings = [];
  if (ui.independenceScore < 80) warnings.push("Independence score below 80%");
  if (ui.longFlowWarnings > 0) warnings.push(`${ui.longFlowWarnings} long chained test flow(s) detected`);

  if (warnings.length === 0) {
    lines.push("- No UI flow-structure warnings detected.");
  } else {
    lines.push(`### Warning: ${warnings.join("; ")}`);
    lines.push("- **Missing Tests**");
    lines.push("  - Add short isolated checkout error UX flow (validation + retry).");
    lines.push("  - Add explicit post-failure state continuity checks.");
    lines.push("- **Implementation Proposal**");
    lines.push("  - Split long scenarios into multiple tests with fresh `goto()` setup.");
    lines.push("  - Reuse page-object methods to keep selectors stable and tests readable.");
    lines.push("- **Suggested File Placement**");
    lines.push("  - `frontend/e2e/tests/shop.spec.ts`");
    lines.push("  - `frontend/e2e/tests/checkout-errors.spec.ts`");
  }

  lines.push("");
  lines.push("### Flow Inventory");
  for (const analysis of ui.analyses) {
    lines.push(`- \`${analysis.file}\`: ${analysis.tests} test(s)`);
  }

  return lines.join("\n");
}

function buildPrioritizedGaps(unitSurface, endpoints, coverageSet, ui) {
  const lines = [];
  lines.push("## Prioritized Gaps");
  lines.push("");

  const uncoveredEndpoints = endpoints
    .filter((endpoint) => !coverageSet.has(endpointKey(endpoint.method, endpoint.path)))
    .map((endpoint) => endpointKey(endpoint.method, endpoint.path));

  lines.push(`1. Integration/API: cover uncovered endpoints (${uncoveredEndpoints.length}).`);
  if (uncoveredEndpoints.length) {
    lines.push(`   - Highest priority: ${uncoveredEndpoints.slice(0, 4).join(", ")}.`);
  }
  lines.push(`2. Unit: add direct tests for untested service modules (${unitSurface.missing.length}).`);
  if (unitSurface.missing.length) {
    lines.push(`   - Missing modules: ${unitSurface.missing.join(", ")}.`);
  }
  lines.push("3. UI: add dedicated checkout failure UX spec and keep flows short.");
  if (ui.longFlowWarnings > 0) {
    lines.push(`   - Split ${ui.longFlowWarnings} long chained flow(s).`);
  }

  return lines.join("\n");
}

async function main() {
  const { outFile } = parseArgs();
  await mkdir(path.dirname(outFile), { recursive: true });

  const [unitCoverage, mountsData, unitSurface, ui] = await Promise.all([
    readUnitCoverage(),
    parseMounts(),
    analyzeUnitTestSurface(),
    analyzeUiFlows(),
  ]);

  const routeEndpoints = await parseRouteEndpoints(mountsData.mounts);
  const endpoints = [...mountsData.directEndpoints, ...routeEndpoints].sort((a, b) =>
    endpointKey(a.method, a.path).localeCompare(endpointKey(b.method, b.path)),
  );

  const integration = await readIntegrationCoverage(endpoints);

  const now = new Date().toISOString();
  const report = [
    "# Test Pyramid Coverage Report",
    "",
    `Generated: ${now}`,
    "",
    buildUnitSection(unitCoverage, unitSurface),
    "",
    buildIntegrationSection(endpoints, integration.covered),
    "",
    buildUiSection(ui),
    "",
    buildPrioritizedGaps(unitSurface, endpoints, integration.covered, ui),
    "",
  ].join("\n");

  await writeFile(outFile, report, "utf-8");
  process.stdout.write(`Report written to ${outFile}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
