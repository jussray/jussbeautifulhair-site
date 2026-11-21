import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const founder = await readFile(new URL("../.github/workflows/founder-funnel-exact-head.yml", import.meta.url), "utf8");
const shopify = await readFile(new URL("../.github/workflows/shopify-headless-exact-head.yml", import.meta.url), "utf8");

function stepBody(workflow, name, nextName) {
  const start = workflow.indexOf(`      - name: ${name}`);
  const end = workflow.indexOf(`      - name: ${nextName}`, start + 1);
  assert.ok(start >= 0 && end > start, `Missing or reordered workflow steps: ${name}`);
  return workflow.slice(start, end);
}

test("Founder Funnel waits for exact production proof with a bounded low-rate API poll", () => {
  const step = stepBody(founder, "Wait for exact production Shopify proof", "Verify production Cloudflare credentials are present");
  assert.match(step, /for attempt in \{1\.\.36\}/);
  assert.match(step, /if \[ "\$attempt" -eq 36 \]/);
  assert.match(step, /sleep 10/);
  assert.match(step, /\$EXPECTED_HEAD_SHA\/check-runs/);
  assert.match(step, /Verify trusted production Shopify browser proof/);
  assert.match(step, /conclusion === "success"/);
  assert.match(step, /exit 1/);
});

test("Shopify Bridge waits up to ten minutes for exact Cloudflare build without rapid polling", () => {
  const step = stepBody(shopify, "Wait for exact Cloudflare Worker build", "Prove exact live SHA and branded front door");
  assert.match(step, /for attempt in \{1\.\.60\}/);
  assert.match(step, /if \[ "\$attempt" -eq 60 \]/);
  assert.match(step, /sleep 10/);
  assert.match(step, /\$EXPECTED_HEAD_SHA\/check-runs/);
  assert.match(step, /Workers Builds: jussbeautifulhair-site/);
  assert.match(step, /conclusion === "success"/);
  assert.match(step, /exit 1/);
});
