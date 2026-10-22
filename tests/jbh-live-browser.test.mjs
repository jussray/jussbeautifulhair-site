import assert from "node:assert/strict";
import test from "node:test";
import { connectJbhProofBrowser } from "../scripts/jbh-live-browser.mjs";

test("local proof browser launches without Cloudflare credentials", async () => {
  const browser = {close: async () => {}};
  const fakeChromium = {
    launch: async (options) => { assert.equal(options.headless, true); return browser; },
    connectOverCDP: async () => { throw new Error("remote session should not be created"); },
  };
  const result = await connectJbhProofBrowser(fakeChromium, {});
  assert.equal(result.transport, "local-chromium");
  assert.equal(result.browser, browser);
});

test("trusted Cloudflare proof mode rejects missing credentials and unsupported modes", async () => {
  const fakeChromium = { launch: async () => { throw new Error("should not launch"); } };
  await assert.rejects(
    connectJbhProofBrowser(fakeChromium, {JBH_PROOF_BROWSER_MODE: "cloudflare-cdp"}),
    /authorized account ID and API token/,
  );
  await assert.rejects(
    connectJbhProofBrowser(fakeChromium, {JBH_PROOF_BROWSER_MODE: "invalid"}),
    /Unsupported JBH proof browser mode/,
  );
});

test("Cloudflare CDP proof connects remotely and preserves viewport without exposing credentials", async () => {
  let connected = null;
  let viewport = null;
  let closed = false;
  const page = { setViewportSize: async (size) => { viewport = size; } };
  const fakeChromium = {
    launch: async () => { throw new Error("should not launch"); },
    connectOverCDP: async (url, options) => {
      connected = {url, options};
      return {contexts: () => [{newPage: async () => page}], close: async () => {closed = true;}};
    },
  };
  const accountId = "b".repeat(32);
  const token = "fixture-token-not-real";
  const output = await connectJbhProofBrowser(fakeChromium, {
    JBH_PROOF_BROWSER_MODE: "cloudflare-cdp",
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_API_TOKEN: token,
  });
  assert.equal(output.transport, "cloudflare-cdp");
  assert.match(connected.url, /browser-run\/devtools\/browser/);
  assert.ok(connected.url.includes(accountId));
  assert.ok(!connected.url.includes(token));
  assert.equal(connected.options.headers.Authorization, `Bearer ${token}`);
  assert.equal(await output.browser.newPage({viewport: {width: 390, height: 844}}), page);
  assert.deepEqual(viewport, {width: 390, height: 844});
  await output.browser.close();
  assert.equal(closed, true);
});
