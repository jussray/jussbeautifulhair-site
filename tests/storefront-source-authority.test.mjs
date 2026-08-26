import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lint = readFileSync(
  new URL("../scripts/lint-storefront.mjs", import.meta.url),
  "utf8",
);

test("forbidden alternate paths are bound to tracked repository source", () => {
  assert.match(lint, /async function isTrackedRepositoryPath\(relativePath\)/);
  assert.match(lint, /execFileAsync\("git", \["ls-files", "--", relativePath\]/);
  assert.match(lint, /return stdout\.trim\(\)\.length > 0;/);
  assert.match(lint, /return exists\(relativePath\);/);
  assert.match(lint, /if \(await isTrackedRepositoryPath\(forbiddenPath\)\)/);
  assert.doesNotMatch(lint, /if \(await exists\(forbiddenPath\)\)/);
});
