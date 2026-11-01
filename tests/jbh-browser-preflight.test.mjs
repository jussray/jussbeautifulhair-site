import test from "node:test";
import assert from "node:assert/strict";
import { validatePreflightObservation, checkBrowserRunPreflight } from "../scripts/jbh-browser-preflight.mjs";

const SHA = "a".repeat(40);
const payload = { ok: true, sha: SHA, identitySource: "asset-build-proof", evidenceRole: "identity-observation", authority: "none" };

test("Browser Run credential preflight accepts only evidence-bound identity observations", () => {
  assert.deepEqual(validatePreflightObservation(payload), { releaseShaObserved: SHA, source: "asset-build-proof" });
  assert.throws(() => validatePreflightObservation({ ...payload, sha: "not-a-sha" }), /exact commit SHA/);
  assert.throws(() => validatePreflightObservation({ ...payload, authority: "production-release" }), /none/);
  assert.throws(() => validatePreflightObservation({ ...payload, identitySource: "user-input" }), /evidence-bound/);
});

test("browser token preflight uses authenticated Cloudflare CDP, only observes /version and closes session", async () => {
  const visits = [];
  let closed = 0;
  let pagesClosed = 0;
  const stubPage = {
    setViewportSize: async (viewport) => { visits.push({ viewport }); },
    goto: async (url, options) => {
      visits.push({ url, options });
      return {
        ok: () => true,
        status: () => 200,
        allHeaders: async () => ({ "content-type": "application/json;charset=utf-8" }),
        text: async () => JSON.stringify(payload),
      };
    },
    close: async () => { pagesClosed++; },
  };
  const fakeChromium = {
    connectOverCDP: async () => ({
      contexts: () => [{ newPage: async () => stubPage }],
      close: async () => { closed++; },
    }),
  };
  const result = await checkBrowserRunPreflight(fakeChromium, {
    JBH_PROOF_BROWSER_MODE: "cloudflare-cdp",
    CLOUDFLARE_ACCOUNT_ID: "b".repeat(32),
    CLOUDFLARE_BROWSER_RUN_TOKEN: "not-a-real-secret",
  });
  assert.equal(result.browserTransport, "cloudflare-cdp");
  assert.equal(result.releaseShaObserved, SHA);
  assert.equal(result.productionReceipt, false);
  assert.equal(result.preflightOnly, true);
  assert.equal(result.checkoutSubmitted, false);
  assert.equal(visits.find(x => x.url)?.url, "https://jussbeautifulhair.com/version");
  assert.equal(closed, 1);
  assert.equal(pagesClosed, 1);
});

test("browser token preflight fails closed without trusted mode", async () => {
  await assert.rejects(checkBrowserRunPreflight({}, {}), /requires cloudflare-cdp mode/);
});
