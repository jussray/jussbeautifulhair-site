import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(
  new URL("../client/src/pages/Home.tsx", import.meta.url),
  "utf8",
);

test("homepage keeps loading, failed truth, and verified-empty catalog states distinct", () => {
  assert.match(home, /isLoading\s*\?\s*\(/);
  assert.match(home, /:\s*isError\s*\?\s*\(/);
  assert.match(home, /data-testid="home-catalog-unavailable"/);
  assert.match(home, /Live inventory could not be verified/);
  assert.match(home, /No stale prices or availability are being shown\./);
  assert.match(home, /data-testid="home-catalog-verified-empty"/);
  assert.match(home, /No Shopify products are available for sale right now\./);
});

test("homepage catalog failure exposes a real React Query retry and fail-closed commerce surface", () => {
  assert.match(home, /data-testid="button-retry-home-catalog"/);
  assert.match(home, /disabled=\{isFetching\}/);
  assert.match(home, /onClick=\{\(\) => void refetch\(\)\}/);
  assert.match(home, /\{isFetching \? "Checking Shopify…" : "Try Again"\}/);
  assert.match(home, /\{signature && \(/);
  assert.match(home, /\{categoryPreview\.length > 0 && \(/);
});
