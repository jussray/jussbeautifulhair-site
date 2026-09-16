import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function groupFor(robots, agent) {
  const escaped = agent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = robots.match(new RegExp(`User-agent: ${escaped}\\n([\\s\\S]*?)(?=\\nUser-agent: |\\nSitemap: |$)`));
  assert.ok(match, `missing robots group for ${agent}`);
  return match[1];
}

test("training crawlers are denied while discovery crawlers retain public storefront access", async () => {
  const robots = await read("client/public/robots.txt");

  for (const agent of ["GPTBot", "ClaudeBot", "Google-Extended"]) {
    const group = groupFor(robots, agent);
    assert.match(group, /^Disallow: \/$/m);
    assert.doesNotMatch(group, /^Allow:/m);
  }

  for (const agent of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "Googlebot", "*"]) {
    const group = groupFor(robots, agent);
    assert.match(group, /^Allow: \/$/m);
    assert.match(group, /^Disallow: \/api\/$/m);
    assert.match(group, /^Disallow: \/checkout$/m);
    assert.match(group, /^Disallow: \/cart$/m);
  }

  assert.match(robots, /Sitemap: https:\/\/jussbeautifulhair\.com\/sitemap\.xml/);
});

test("machine-readable crawler policy grants no transaction authority", async () => {
  const policy = JSON.parse(await read("client/public/crawlers.json"));
  const worker = await read("worker/index.ts");
  const sitemap = await read("client/public/sitemap.xml");

  assert.equal(policy.schema, "juss/ai-crawler-contract@v1");
  assert.equal(policy.policy.model_training, "deny");
  assert.equal(policy.policy.bulk_dataset_collection, "deny");
  assert.equal(policy.policy.write_or_action_authority, "none");
  assert.equal(policy.bots.GPTBot, "deny");
  assert.equal(policy.bots["OAI-SearchBot"], "allow_public_storefront");
  assert.equal(policy.attribution.requested, true);
  assert.match(worker, /Content-Signal", "ai-train=no, search=yes, ai-input=no"/);
  assert.match(sitemap, /<loc>https:\/\/jussbeautifulhair\.com\/<\/loc>/);
});
