// Real-provider no-payment smoke: run against a deployed TEST-MODE Stripe
// checkout Worker at the exact expected SHA. Does not submit a payment.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import process from "node:process";

const base = process.env.JBH_STRIPE_TEST_BASE_URL;
const sha = process.env.EXPECTED_HEAD_SHA;
if (!base || !/^https:\/\/[^/]+$/.test(base) ||
    !/^[a-f0-9]{40}$/.test(sha || "") ||
    process.env.JBH_NO_PAYMENT_PROOF !== "true") {
  throw new Error("Require HTTPS JBH_STRIPE_TEST_BASE_URL, exact EXPECTED_HEAD_SHA, and JBH_NO_PAYMENT_PROOF=true");
}
const versionResp = await fetch(base + "/version", { cache: "no-store" });
const version = await versionResp.json().catch(() => null);
if (!versionResp.ok || version?.sha !== sha) {
  throw new Error("Deployed Worker is not the exact tested source SHA");
}
const catalogResp = await fetch(base + "/api/stripe/catalog", { cache: "no-store" });
const catalog = await catalogResp.json().catch(() => null);
const product = catalog?.products?.find((p) => p.availableForSale && p.variants?.some((v) => v.availableForSale));
if (!catalogResp.ok || catalog?.source !== "jbh-approved-stripe-catalog" || !product) {
  throw new Error("Real Stripe catalog has no approved sellable product");
}

const browser = await chromium.launch({ headless: true });
await mkdir("artifacts/jbh-stripe-prelaunch", { recursive: true });
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1365, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    const failedCalls = [];
    page.on("pageerror", (error) => failedCalls.push(error.message));
    // The Worker must create a REAL test-mode Checkout Session; a payment page
    // is intentionally blocked so the smoke cannot submit a charge.
    await page.route("https://checkout.stripe.com/**", (route) => route.abort("blockedbyclient"));
    await page.goto(base + "/shop", { waitUntil: "domcontentloaded" });
    await page.getByTestId("card-product-" + product.id).waitFor({ state: "visible" });
    await page.getByTestId("card-product-" + product.id).click();
    await page.getByTestId("button-add-to-cart").first().click();
    await page.goto(base + "/cart", { waitUntil: "domcontentloaded" });
    await page.getByTestId("button-checkout").click();
    await page.getByTestId("button-place-order").waitFor({ state: "visible" });
    await page.screenshot({ path: "artifacts/jbh-stripe-prelaunch/" + name + "-before-checkout.png", fullPage: true });
    const posted = page.waitForRequest((r) => r.url() === base + "/api/checkout" && r.method() === "POST");
    const returned = page.waitForResponse((r) => r.url() === base + "/api/checkout" && r.request().method() === "POST");
    await page.getByTestId("button-place-order").click();
    const request = await posted;
    const payload = request.postDataJSON();
    if (!payload?.checkoutAttemptId || !payload?.items?.length ||
        payload.items.some((i) => !i.id || !i.variant || !i.quantity || "price" in i || "total" in i)) {
      throw new Error(name + ": checkout sent browser-controlled money or an invalid line");
    }
    const response = await returned;
    const body = await response.json().catch(() => null);
    if (!response.ok() || typeof body?.url !== "string") {
      throw new Error(name + ": real Stripe Checkout Session was not created");
    }
    const destination = new URL(body.url);
    if (destination.origin !== "https://checkout.stripe.com" ||
        !destination.pathname.includes("cs_test_") || destination.href.includes("cs_live_")) {
      throw new Error(name + ": result is not a Stripe test-mode Checkout Session");
    }
    if (failedCalls.length) throw new Error(name + ": browser errors: " + failedCalls.join("; "));
    console.log(name + ": exact SHA / approved catalog / test-mode session verified, no payment submitted");
    await page.close();
  }
} finally {
  await browser.close();
}
