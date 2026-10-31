import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const app = readFileSync("client/src/App.tsx", "utf8");
const layout = readFileSync("client/src/components/Layout.tsx", "utf8");
const sitemap = readFileSync("client/public/sitemap.xml", "utf8");

for (const [route, moduleName, file] of [
  ["/hair-care", "HairCare", "HairCare.tsx"],
  ["/length-guide", "LengthGuide", "LengthGuide.tsx"],
  ["/order-help", "OrderHelp", "OrderHelp.tsx"],
]) {
  test(`customer help route ${route} is linked and indexed`, () => {
    assert.ok(app.includes(`path="${route}" component={${moduleName}}`));
    assert.ok(layout.includes(`href="${route}"`));
    assert.ok(sitemap.includes(`https://jussbeautifulhair.com${route}`));
    assert.ok(readFileSync(`client/src/pages/${file}`, "utf8").includes("export default function"));
  });
}

test("order assistance never exposes a public order lookup endpoint", () => {
  const help = readFileSync("client/src/pages/OrderHelp.tsx", "utf8");
  assert.match(help, /shopify\.com\/84576043251\/account\/orders/);
  assert.doesNotMatch(help, /fetch\s*\(|\/api\/orders/);
});
