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
  assert.match(home, /Live inventory could not be verified/);
  // Amended 2026-11-15 (catalog display-fallback increment, founder order:
  // "I want the hair and inventory to show"): while live inventory is
  // unverified, the homepage now shows the static collection for browsing at
  // its standard prices, so the old "no prices are being shown" copy no
  // longer holds. The surviving guarantees are the honest paused-ordering
  // notice, no availability promise, and no cart path from fallback items —
  // locked by tests/catalog-display-fallback-contract.test.mjs.
  assert.match(home, /online ordering is paused/);
  assert.match(home, /no\s+availability is promised/);
  assert.match(home, /data-testid="home-catalog-fallback"/);
  assert.match(home, /data-testid="home-catalog-verified-empty"/);
  assert.match(home, /No approved JussPay products are available for checkout right now\./);
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
  assert.match(home, /\{isFetching \? "Checking availability…" : "Try Again"\}/);
});
