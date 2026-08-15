import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const contract = JSON.parse(read(".control-room/commerce-seam.json"));
const worker = read("worker/index.ts");
const catalog = read("client/src/lib/shopifyCatalog.ts");
const checkout = read("client/src/pages/Checkout.tsx");
const bridgeDoc = read("docs/SHOPIFY_HEADLESS_BRIDGE.md");
const readme = read("README.md");

function requireTruth(condition, message) {
  if (!condition) {
    console.error(`[commerce-seam] ${message}`);
    process.exit(1);
  }
}

requireTruth(contract.schemaVersion === 1, "schemaVersion must remain 1");
requireTruth(contract.contractId === "jbh-shopify-private-orders@v1", "unexpected contract id");
requireTruth(contract.publicRepository === "jussray/jussbeautifulhair-site", "public repository authority drifted");
requireTruth(contract.privateRepository === "jussray/jbh-private", "private repository authority drifted");
requireTruth(contract.shopify.shopDomain === "8qp1z2-az.myshopify.com", "Shopify shop domain drifted");
requireTruth(contract.shopify.apiVersion === "2026-07", "Storefront API version drifted");
requireTruth(contract.shopify.publicVendor === "JBH", "public Shopify vendor boundary drifted");
requireTruth(contract.shopify.catalogPath === "/api/shopify/catalog", "catalog route drifted");
requireTruth(contract.shopify.cartPath === "/api/shopify/cart", "cart route drifted");
requireTruth(contract.shopify.paidTopic === "orders/paid", "paid-order topic drifted");
requireTruth(contract.privateOrderControl.serviceName === "jbh-private-payment-control", "private Worker identity drifted");
requireTruth(contract.privateOrderControl.healthPath === "/health", "private health route drifted");
requireTruth(contract.privateOrderControl.paidWebhookPath === "/webhooks/shopify/orders-paid", "private paid webhook route drifted");
requireTruth(contract.productionTruth.authority === "external-provider-evidence", "production truth must stay provider-backed");
requireTruth(contract.productionTruth.repoMergeAloneIsActivationProof === false, "a repository merge must never count as activation proof");

requireTruth(worker.includes(`shopDomain: "${contract.shopify.shopDomain}"`), "Worker Shopify domain does not match the seam contract");
requireTruth(worker.includes(`apiVersion: "${contract.shopify.apiVersion}"`), "Worker Storefront API version does not match the seam contract");
requireTruth(worker.includes(`vendor: "${contract.shopify.publicVendor}"`), "Worker vendor boundary does not match the seam contract");
requireTruth(worker.includes(`url.pathname === "${contract.shopify.catalogPath}"`), "Worker catalog route does not match the seam contract");
requireTruth(worker.includes(`url.pathname === "${contract.shopify.cartPath}"`), "Worker cart route does not match the seam contract");
requireTruth(worker.includes('url.pathname === "/version"'), "public deployment has no release-identity route");
requireTruth(worker.includes("sha: getReleaseSha(env)"), "/version no longer exposes the deployed release SHA");

requireTruth(catalog.includes(`shopDomain: "${contract.shopify.shopDomain}"`), "browser Shopify domain does not match the seam contract");
requireTruth(catalog.includes(`apiVersion: "${contract.shopify.apiVersion}"`), "browser Storefront API version does not match the seam contract");
requireTruth(catalog.includes(`vendor: "${contract.shopify.publicVendor}"`), "browser vendor boundary does not match the seam contract");
requireTruth(checkout.includes(`fetch("${contract.shopify.cartPath}"`), "Checkout page is not using the contracted Shopify cart route");

requireTruth(bridgeDoc.includes(contract.privateRepository), "Shopify bridge doc must name the canonical private repository");
requireTruth(bridgeDoc.includes(contract.privateOrderControl.paidWebhookPath), "Shopify bridge doc must name the private paid-order webhook path");
requireTruth(readme.includes("Shopify-hosted checkout"), "README must describe Shopify as the active physical checkout handoff");
requireTruth(!readme.includes("**Payments:** Stripe-hosted Checkout."), "README still claims Stripe is the active payment handoff");

console.log(`[commerce-seam] public contract verified: ${contract.contractId}`);
