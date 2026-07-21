import { readFile } from 'node:fs/promises';

const policy = JSON.parse(await readFile(new URL('../.control-room/cookie-policy.json', import.meta.url), 'utf8'));
const boundaries = [
  ['worker/index.ts', await readFile(new URL('../worker/index.ts', import.meta.url), 'utf8')],
  ['api/checkout.ts', await readFile(new URL('../api/checkout.ts', import.meta.url), 'utf8')],
];
const errors = [];
const requireValue = (condition, message) => {
  if (!condition) errors.push(message);
};

requireValue(policy.repository === 'jussray/jussbeautifulhair-site', 'repository mismatch');
requireValue(policy.firstPartyCookies?.length === 0, 'first-party cookie count must remain zero');
requireValue(
  policy.platformManagedCookies?.some((entry) => entry.provider === 'Cloudflare'),
  'Cloudflare provider-managed boundary missing',
);
requireValue(
  policy.platformManagedCookies?.some((entry) => entry.provider === 'Stripe Checkout'),
  'Stripe provider-managed boundary missing',
);

const forbidden = [
  ['Set-Cookie', /['"`]Set-Cookie['"`]/i],
  ['Cookie request header read', /headers\.(?:get|cookie)|headers\[['"`]cookie['"`]\]|headers\.cookie/i],
  ['document.cookie', /\bdocument\.cookie\b/],
  ['cookieStore API', /\bcookieStore\b/],
  ['request cookie parser', /\b(?:parseCookies?|cookieParser|req\.cookies)\b/i],
];

for (const [path, source] of boundaries) {
  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) errors.push(`${path}: forbidden ${label}`);
  }
  requireValue(source.includes('checkoutAttemptId'), `${path}: explicit checkout attempt ID missing`);
  requireValue(source.includes('idempotencyKey'), `${path}: Stripe idempotency key missing`);
  requireValue(source.includes('Cache-Control'), `${path}: no-store response boundary missing`);
}

if (errors.length > 0) {
  console.error('Public hair cookie contract failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Public hair cookie contract verified.');
console.log('First-party cookies: 0');
console.log('Checkout cookie dependencies: 0');
