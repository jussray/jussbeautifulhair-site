import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("automatic Worker build keeps runtime truth routes out of SPA fallback", () => {
  assert.match(config, /not_found_handling\s*=\s*"single-page-application"/);
  assert.match(
    config,
    /run_worker_first\s*=\s*\[\s*"\/api\/\*"\s*,\s*"\/version"\s*,\s*"\/\.well-known\/jbh-meta-agent\.json"\s*\]/,
  );
});
