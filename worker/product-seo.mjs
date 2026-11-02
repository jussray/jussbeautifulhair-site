// Read-only, approved public copy from client/src/lib/shopifyCatalog.ts.
// Tests fail if the approved UI copy or sitemap diverges. Never infer prices or inventory.
export const APPROVED_SEO_PRODUCTS = Object.freeze({
  "afro-kinky-human-hair-bundle-deal": {
    "name": "Afro Kinky Human Hair Bundle Deal",
    "description": "Three human-hair bundles in a coordinated graduated-length set for a full afro-kinky install."
  },
  "afro-kinky-human-hair-bundles": {
    "name": "Afro Kinky Human Hair Bundles",
    "description": "Human-hair bundles with dense afro-kinky texture and live Shopify length availability."
  },
  "body-wave-4x4-transparent-lace-closure": {
    "name": "Body Wave 4×4 Transparent Lace Closure",
    "description": "A 4×4 transparent-lace closure with body-wave texture for a natural-looking finished install."
  },
  "body-wave-human-hair-bundle-deal": {
    "name": "Body Wave Human Hair Bundle Deal",
    "description": "Three human-hair bundles in one graduated-length set with soft body-wave movement."
  },
  "deep-wave-4x4-transparent-lace-closure": {
    "name": "Deep Wave 4×4 Transparent Lace Closure",
    "description": "A 4×4 transparent-lace closure with defined deep-wave texture and flexible parting."
  },
  "deep-wave-human-hair-bundle-deal": {
    "name": "Deep Wave Human Hair Bundle Deal",
    "description": "Three human-hair bundles in one graduated-length set with rich deep-wave definition."
  },
  "kinky-straight-human-hair-bundles": {
    "name": "Flawless Kinky Straight Bundles",
    "description": "Human-hair bundles with kinky-straight texture and live Shopify length availability."
  },
  "blonde-body-wave-human-hair-bundles": {
    "name": "Juss Blonde",
    "description": "Pre-lightened human-hair bundles with soft body-wave movement and live Shopify length availability."
  },
  "kinky-curly-human-hair-bundles": {
    "name": "Kinky Curly Human Hair Bundles",
    "description": "Human-hair bundles with defined kinky-curly texture and live Shopify length availability."
  },
  "body-wave-human-hair-bundles": {
    "name": "Lawless Body Wave Bundles",
    "description": "Human-hair bundles with soft body-wave movement and live Shopify length availability."
  },
  "deep-wave-human-hair-bundles": {
    "name": "Lawless Deep Wave Bundles",
    "description": "Human-hair bundles with defined deep-wave texture and live Shopify length availability."
  },
  "loose-wave-human-hair-bundles": {
    "name": "Lawless Loose Wave Bundles",
    "description": "Human-hair bundles with soft loose-wave texture and live Shopify length availability."
  },
  "loose-wave-13x4-transparent-lace-frontal": {
    "name": "Loose Wave 13×4 Transparent Lace Frontal",
    "description": "A 13×4 transparent-lace frontal with loose-wave texture and flexible front styling."
  },
  "loose-wave-4x4-transparent-lace-closure": {
    "name": "Loose Wave 4×4 Transparent Lace Closure",
    "description": "A 4×4 transparent-lace closure with loose-wave texture for a natural-looking finished install."
  },
  "loose-wave-human-hair-bundle-deal": {
    "name": "Loose Wave Human Hair Bundle Deal",
    "description": "Three human-hair bundles in one graduated-length set with soft loose-wave movement."
  },
  "spanish-wave-human-hair-bundles": {
    "name": "Spanish Wave Human Hair Bundles",
    "description": "Human-hair bundles with Spanish-wave texture and live Shopify length availability."
  },
  "straight-13x4-transparent-lace-frontal": {
    "name": "Straight 13×4 Transparent Lace Frontal",
    "description": "A 13×4 transparent-lace frontal with straight texture and flexible front styling."
  },
  "straight-4x4-transparent-lace-closure": {
    "name": "Straight 4×4 Transparent Lace Closure",
    "description": "A 4×4 transparent-lace closure with straight texture for a polished finished install."
  },
  "straight-human-hair-bundle-deal": {
    "name": "Straight Human Hair Bundle Deal",
    "description": "Three human-hair bundles in one graduated-length set for a sleek straight finished look."
  },
  "straight-human-hair-bundles": {
    "name": "Straight Human Hair Bundles",
    "description": "Human-hair bundles with a sleek straight finish and live Shopify length availability."
  }
});
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderProductSeoHtml(html, handle, liveProduct) {
  const approved = Object.hasOwn(APPROVED_SEO_PRODUCTS,handle) ? APPROVED_SEO_PRODUCTS[handle] : null;
  if (!approved) return null;
  const canonical = 'https://jussbeautifulhair.com/product/'+handle;
  const title = approved.name+' | Juss Beautiful Hair';
  const firstVariant = Array.isArray(liveProduct?.variants) ? liveProduct.variants.find(
    v => Number.isFinite(v.price) && v.price > 0 && /^[A-Z]{3}$/.test(v.currencyCode || '')
  ) : null;
  const verified = liveProduct?.id === handle && liveProduct?.vendor === 'JBH' && !!firstVariant;
  const offer = verified ? {
    '@type':'Offer', url:canonical, priceCurrency:firstVariant.currencyCode,
    price: Number(firstVariant.price).toFixed(2),
    availability: liveProduct.availableForSale && firstVariant.availableForSale
      ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
  } : null;
  const schema = {
    '@context':'https://schema.org', '@type':'Product',
    name:approved.name, description:approved.description, url:canonical,
    brand:{ '@type':'Brand', name:'Juss Beautiful Hair' },
    ...(offer ? {offers:offer} : {})
  };
  const jsonLd = JSON.stringify(schema).replace(/</g,'\\u003c');
  const head = '<title>'+escapeHtml(title)+'</title>'+
    '<meta name="description" content="'+escapeHtml(approved.description)+'" />'+
    '<link rel="canonical" href="'+canonical+'" />'+
    '<meta property="og:title" content="'+escapeHtml(title)+'" />'+
    '<meta property="og:description" content="'+escapeHtml(approved.description)+'" />'+
    '<meta property="og:url" content="'+canonical+'" />'+
    '<script type="application/ld+json">'+jsonLd+'</script>';
  const cleanHead = html.replace(/<title>[^<]*<\/title>/i,'')
    .replace(/<meta name="description"[^>]*>/i,'')
    .replace(/<link rel="canonical"[^>]*>/i,'')
    .replace(/<meta property="og:(?:title|description|url)"[^>]*>/gi,'');
  const content = '<main aria-label="Product details"><h1>'+escapeHtml(approved.name)+'</h1>'+
    '<p>'+escapeHtml(approved.description)+'</p>'+
    (offer ? '<p>'+ (liveProduct.availableForSale && firstVariant.availableForSale ? 'Available' : 'Unavailable') +
      ' · '+escapeHtml(firstVariant.currencyCode)+' '+escapeHtml(Number(firstVariant.price).toFixed(2)) +'</p>'
      : '<p>Live price and availability will load in the store.</p>')+
    '<p><a href="/shop">Browse Juss Beautiful Hair products</a></p></main>';
  return { html:cleanHead.replace('</head>',head+'</head>')
    .replace('<div id="root"></div>','<div id="root">'+content+'</div>'),
    indexable:verified };
}
