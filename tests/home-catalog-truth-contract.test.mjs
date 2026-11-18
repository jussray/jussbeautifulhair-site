import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(
  new URL("../client/src/pages/Home.tsx", import.meta.url),
  "utf8",
);

test("homepage keeps loading, failed truth, and verified-empty catalog states distinct", () => {
  assert.match(home, /isLoading\s*\?\s*\(/);
  assert.match(home, /catalogUnavailable\s*\?\s*\(/);
  assert.match(home, /data-testid="home-catalog-unavailable"/);
  assert.match(home, /Ordering is temporarily unavailable/);
  assert.match(home, /We are not displaying unapproved prices or availability\./);
  assert.match(home, /data-testid="home-catalog-verified-empty"/);
  assert.match(home, /No products are approved for ordering right now\./);
});

test("initial and refetch errors fail closed before customer-facing products are derived", () => {
  assert.match(home, /isRefetchError/);
  assert.match(home, /const catalogUnavailable = isError \|\| isRefetchError;/);
  assert.match(home, /const authoritativeProducts = catalogUnavailable \? \[\] : products;/);
  assert.match(
    home,
    /const availableProducts = authoritativeProducts\.filter\(\(product\) => product\.availableForSale\);/,
  );
  assert.match(home, /\{signature && \(/);
  assert.match(home, /\{categoryPreview\.length > 0 && \(/);
});

test("homepage catalog failure exposes a real React Query retry", () => {
  assert.match(home, /data-testid="button-retry-home-catalog"/);
  assert.match(home, /disabled=\{isFetching\}/);
  assert.match(home, /onClick=\{\(\) => void refetch\(\)\}/);
  assert.match(home, /\{isFetching \? "Checking collection…" : "Try Again"\}/);
});
