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
  test(`${label} binds forbidden alternate paths to tracked repository source`, () => {
    assert.match(source, /isTrackedRepositoryPath/);
    assert.match(source, /execFileAsync\("git", \["ls-files", "--", relativePath\]/);
    assert.match(source, /return stdout\.trim\(\)\.length > 0;/);
    assert.match(source, /return exists\(relativePath\);/);
    assert.match(source, /isTrackedRepositoryPath\(forbiddenPath\)/);
  });
}

 test("static lint no longer equates build-workspace presence with repository authority", () => {
  assert.doesNotMatch(lint, /if \(await exists\(forbiddenPath\)\)/);
});
