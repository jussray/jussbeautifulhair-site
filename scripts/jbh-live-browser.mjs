// A trusted release may verify production with a Cloudflare-hosted Chromium
// session rather than a GitHub runner blocked by Cloudflare's Browser Integrity Check.
// This never disables Cloudflare protections or bypasses site authentication.
export async function connectJbhProofBrowser(chromium, env = process.env) {
  const mode = String(env.JBH_PROOF_BROWSER_MODE || "local").trim();
  if (mode === "local") {
    return { browser: await chromium.launch({ headless: true }), transport: "local-chromium" };
  }
  if (mode !== "cloudflare-cdp") {
    throw new Error("Unsupported JBH proof browser mode; fail closed.");
  }
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const token = String(env.CLOUDFLARE_BROWSER_RUN_TOKEN || "").trim();
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !token) {
    throw new Error("Cloudflare Browser Run proof requires an authorized account ID and API token.");
  }
  const endpoint = `wss://api.cloudflare.com/client/v4/accounts/${accountId}/browser-run/devtools/browser?keep_alive=600000`;
  // Credentials are confined to the CDP upgrade headers and never placed in a URL or artifact.
  const connected = await chromium.connectOverCDP(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30_000,
  });
  const context = connected.contexts()[0];
  if (!context) {
    await connected.close();
    throw new Error("Cloudflare Browser Run returned no default browser context.");
  }
  return {
    transport: "cloudflare-cdp",
    browser: {
      async newPage(options = {}) {
        const page = await context.newPage();
        if (options.viewport) await page.setViewportSize(options.viewport);
        return page;
      },
      close: () => connected.close(),
    },
  };
}
