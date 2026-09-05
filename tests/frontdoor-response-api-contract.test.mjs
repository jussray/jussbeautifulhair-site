import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const livePlaywright = await readFile(
  new URL("../scripts/frontdoor-live-playwright.mjs", import.meta.url),
  "utf8",
);

test("front-door JSON parser keeps native fetch and Playwright header APIs distinct", () => {
  assert.match(
    livePlaywright,
    /const contentType = response\.headers\.get\("content-type"\) \|\| "";/,
    "Native fetch Response headers must be read through response.headers.get().",
  );
  assert.doesNotMatch(
    livePlaywright,
    /response\.headers\(\)\.get\(/,
    "Do not mix Playwright response.headers() with native fetch Headers.get().",
  );
  assert.match(
    livePlaywright,
    /knowledgeResponse\.headers\(\)\["content-type"\]/,
    "Playwright APIResponse headers must continue using response.headers().",
  );
});
