import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const contract = JSON.parse(read(".control-room/commerce-seam.json"));
const worker = read("worker/index.ts");
const catalogClient = read("client/src/lib/shopifyCatalog.ts");
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

requireTruth(worker.includes(`shopDomain: "${contract.shopify.shopDomain}"`), "public Worker shop domain does not match the seam contract");
requireTruth(worker.includes(`apiVersion: "${contract.shopify.apiVersion}"`), "public Worker Storefront API version does not match the seam contract");
requireTruth(worker.includes(`vendor: "${contract.shopify.publicVendor}"`), "public Worker vendor boundary does not match the seam contract");
requireTruth(worker.includes(`"${contract.shopify.catalogPath}"`), "public catalog route does not match the seam contract");
requireTruth(worker.includes(`"${contract.shopify.cartPath}"`), "public cart route does not match the seam contract");
requireTruth(!/SHOPIFY_ADMIN|admin[_-]?token/i.test(worker), "public Worker must not gain Shopify Admin authority");
requireTruth(!worker.includes("SHOPIFY_WEBHOOK_SECRET"), "public Worker must not gain the private Shopify webhook secret");

requireTruth(catalogClient.includes(contract.shopify.shopDomain), "browser checkout authority drifted from canonical Shopify shop");
requireTruth(readme.includes(contract.privateRepository), "public README must name the canonical private repository");
requireTruth(readme.includes(contract.contractId), "public README must name the shared commerce contract id");

console.log(`[commerce-seam] public contract verified: ${contract.contractId}`);
