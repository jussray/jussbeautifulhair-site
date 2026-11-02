import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APPROVED_SEO_PRODUCTS, renderProductSeoHtml } from '../worker/product-seo.mjs';
const input = '<!doctype html><html><head><title>Store homepage</title><meta name="description" content="Old"><link rel="canonical" href="https://jussbeautifulhair.com/" /><meta property="og:url" content="https://jussbeautifulhair.com/" /></head><body><div id="root"></div></body></html>';
const handle = 'body-wave-human-hair-bundles';
test('only founder-approved products are eligible for public SEO metadata', () => {
  const ui = readFileSync(new URL('../client/src/lib/shopifyCatalog.ts', import.meta.url),'utf8');
  const sitemap = readFileSync(new URL('../client/public/sitemap.xml', import.meta.url),'utf8');
  assert.equal(Object.keys(APPROVED_SEO_PRODUCTS).length, 20);
  for (const [h, p] of Object.entries(APPROVED_SEO_PRODUCTS)) {
    assert.match(ui, new RegExp('"' + h + '": approvedLiveShopifyProduct\\('));
    assert.ok(ui.includes('name: "'+p.name+'"'),h);
    assert.ok(ui.includes('"'+p.description+'"'),h);
    assert.ok(sitemap.includes('/product/'+h+'</loc>'),h);
  }
  assert.equal(renderProductSeoHtml(input,'unapproved-product',null),null);
});
test('initial HTML has an individual canonical, title, description, H1, and verified Shopify price and availability', () => {
  const result=renderProductSeoHtml(input,handle,{
    id:handle,vendor:'JBH',availableForSale:true,
    variants:[{price:89.5,currencyCode:'USD',availableForSale:true}]
  });
  assert.equal(result.indexable,true);
  assert.match(result.html,/rel="canonical" href="https:\/\/jussbeautifulhair.com\/product\/body-wave-human-hair-bundles"/);
  assert.match(result.html,/Lawless Body Wave Bundles \| Juss Beautiful Hair/);
  assert.match(result.html,/<h1>Lawless Body Wave Bundles<\/h1>/);
  assert.match(result.html,/"priceCurrency":"USD"/);
  assert.match(result.html,/"price":"89.50"/);
  assert.match(result.html,/"availability":"https:\/\/schema.org\/InStock"/);
  assert.doesNotMatch(result.html,/href="https:\/\/jussbeautifulhair.com\/" \/>/);
});
test('unverified inventory never creates offers or an indexable product claim', () => {
  const result=renderProductSeoHtml(input,handle,null);
  assert.equal(result.indexable,false);
  assert.doesNotMatch(result.html,/"offers":/);
  assert.match(result.html,/Live price and availability will load/);
  const spoof=renderProductSeoHtml(input,handle,{id:handle,vendor:'WRONG',variants:[{price:3,currencyCode:'USD',availableForSale:true}]});
  assert.equal(spoof.indexable,false);
});
