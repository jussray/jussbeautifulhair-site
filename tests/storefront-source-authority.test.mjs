import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lint = readFileSync(
  new URL("../scripts/lint-storefront.mjs", import.meta.url),
  "utf8",
);
const storefrontContract = readFileSync(
  new URL("./storefront-contract.test.mjs", import.meta.url),
  "utf8",
);
const deploymentBoundary = readFileSync(
  new URL("../scripts/verify-deployment-boundary.mjs", import.meta.url),
  "utf8",
);

for (const [label, source] of [
  ["static lint", lint],
  ["storefront contract", storefrontContract],
  ["deployment boundary", deploymentBoundary],
]) {
  test(`${label} can bind provider workspace authority to tracked repository source`, () => {
    assert.match(source, /isTrackedRepositoryPath/);
    assert.match(source, /execFileAsync\("git", \["ls-files", "--", relativePath\]/);
    assert.match(source, /return stdout\.trim\(\)\.length > 0;/);
    assert.match(source, /return exists\(relativePath\);/);
  });
}

test("production guards limit the tracked-source exception to vercel.json", () => {
  for (const source of [lint, deploymentBoundary]) {
    assert.match(
      source,
      /if \(relativePath !== "vercel\.json"\) return exists\(relativePath\);/,
    );
    assert.match(source, /isTrackedRepositoryPath\(forbiddenPath\)/);
  }
});

test("non-Vercel forbidden workspace paths remain fail-closed", () => {
  assert.match(lint, /"api"/);
  assert.match(lint, /"drizzle\.config\.ts"/);
  assert.match(deploymentBoundary, /"jbh-private"/);
  assert.match(deploymentBoundary, /"admin-local"/);
  assert.match(deploymentBoundary, /"vendor-docs"/);
});
