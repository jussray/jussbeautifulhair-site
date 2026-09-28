// Compatibility alias only. The canonical Cloudflare entry remains worker/entry.ts.
// Provider routing is mounted inside worker/entry.ts so checkout, funnel,
// build-proof, security, and Content-Signal contracts stay authoritative.
export { default } from './entry';
