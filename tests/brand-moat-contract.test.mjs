import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

const riskyClaims = [
  "Quality Guaranteed",
  "Most orders ship in 2–3 business days",
  "never tangles",
  "lasts 2+ years",
  "factory pricing",
  "trusted factories",
];

test("brand moat is wired with four evidence-grounded pillars", async () => {
  const [content, component, home, about, handoff] = await Promise.all([
    read("client/src/lib/brandMoat.ts"),
    read("client/src/components/BrandMoatSection.tsx"),
    read("client/src/pages/Home.tsx"),
    read("client/src/pages/About.tsx"),
    read("brand/BRAND_MOAT_FUTUREYOU.md"),
  ]);

  for (const pillar of ["story", "quality", "care", "proof"]) {
    assert.match(content, new RegExp(`id: \\"${pillar}\\"`));
    assert.match(component, new RegExp(`brand-moat-\\$\\{pillar.id\\}`));
  }

  assert.match(content, /Story\. Quality\. Care\. Proof\./);
  assert.match(content, /Missing proof stays missing until verified\./);
  assert.match(home, /import \{ BrandMoatSection \}/);
  assert.match(home, /<BrandMoatSection \/>/);
  assert.match(about, /Story, Quality, Care, and Proof/);

  const publicCopy = `${home}\n${about}\n${content}`;
  for (const claim of riskyClaims) {
    assert.equal(publicCopy.includes(claim), false, `unsupported certainty remains: ${claim}`);
  }

  for (const heading of ["## Who", "## What", "## Where", "## When", "## Why", "## How", "## /futureyou recovery record"]) {
    assert.match(handoff, new RegExp(heading.replace("/", "\\/")));
  }

  assert.match(handoff, /1–2 business days/);
  assert.match(handoff, /3–5 additional business days/);
  assert.match(handoff, /Rollback:/);
  assert.match(handoff, /Next owner:/);
});
