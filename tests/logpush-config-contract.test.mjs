import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const path of ["wrangler.toml", "wrangler.frontdoor.toml"]) {
  test(`${path} opts the canonical Worker into account-scoped Logpush without embedding a destination`, async () => {
    const config = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    const firstTable = config.search(/^\\s*\\[/m);
    const topLevel = firstTable === -1 ? config : config.slice(0, firstTable);

    assert.match(topLevel, /^name\\s*=\\s*"jussbeautifulhair-site"\\s*$/m);
    assert.match(topLevel, /^main\\s*=\\s*"worker\\/entry\\.ts"\\s*$/m);
    assert.match(topLevel, /^logpush\\s*=\\s*true\\s*$/m);
    assert.equal((config.match(/^\\s*logpush\\s*=/gm) ?? []).length, 1);
    assert.match(topLevel, /^workers_dev\\s*=\\s*false\\s*$/m);
    assert.match(topLevel, /^preview_urls\\s*=\\s*false\\s*$/m);
    assert.match(config, /^ENABLE_LEGACY_STRIPE_CHECKOUT\\s*=\\s*"false"\\s*$/m);
    assert.doesNotMatch(config, /destination_conf|secret-access-key|access-key-id|r2:\\/\\//i);
  });
}
