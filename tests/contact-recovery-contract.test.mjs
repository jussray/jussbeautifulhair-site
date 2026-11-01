import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("public contact recovery preserves the private customer-data boundary", async () => {
  const [contact, turnstile, ingress, layout, worker, handoff] = await Promise.all([
    read("client/src/pages/Contact.tsx"),
    read("client/src/components/TurnstileChallenge.tsx"),
    read("client/src/lib/privateIngress.ts"),
    read("client/src/components/Layout.tsx"),
    read("worker/index.ts"),
    read("docs/CONTACT_RECOVERY_FUTUREYOU.md"),
  ]);

  assert.doesNotMatch(worker, /@neondatabase\/serverless/);
  assert.doesNotMatch(worker, /DATABASE_URL/);
  assert.doesNotMatch(worker, /contact_messages/);
  assert.doesNotMatch(worker, /url\.pathname === ["']\/api\/contact["']/);
  assert.doesNotMatch(worker, /url\.pathname === ["']\/api\/newsletter["']/);
  assert.doesNotMatch(worker, /newsletter_subscribers/);

  assert.match(worker, /CONTACT_API_ORIGIN/);
  assert.match(worker, /https:\/\/challenges\.cloudflare\.com/);
  assert.match(worker, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.match(worker, /connect-src \$\{connectSources\}/);

  assert.match(ingress, /VITE_CONTACT_API_URL/);
  assert.match(ingress, /configured\.pathname = "\/newsletter"/);
  assert.match(ingress, /url\.protocol !== "https:" && !local/);
  assert.match(turnstile, /action: "contact" \| "newsletter"/);
  assert.match(turnstile, /action,/);
  assert.match(contact, /VITE_TURNSTILE_SITE_KEY/);
  assert.match(contact, /action="contact"/);
  assert.match(contact, /turnstileToken/);
  assert.match(contact, /companyWebsite/);
  assert.match(contact, /consent/);
  assert.match(contact, /result\.receipt \|\| null/);
  assert.match(contact, /result\.duplicate/);
  assert.match(contact, /Privacy Policy/);
  assert.match(contact, /DM us on Instagram/);

  assert.match(layout, /Wholesale &amp; stylists:/);
  assert.match(layout, /use the contact form/);
  assert.doesNotMatch(layout, /BRAND\.wholesaleEmail/);

  for (const heading of [
    "## Who",
    "## What",
    "## Where",
    "## When",
    "## Why",
    "## How",
    "## Known",
    "## Inferred",
    "## Assumed",
    "## Unknown",
    "## Blocked",
    "## Verification",
    "## Rollback",
    "## Next owner",
  ]) {
    assert.match(handoff, new RegExp(heading));
  }

  assert.match(handoff, /jussray\/jbh-private/);
  assert.match(handoff, /PR #35/);
  assert.match(handoff, /issue #36/);
  assert.match(handoff, /29e38dfafa9809277f98a4c72fb86ff7de998c69/);
  assert.match(handoff, /jussray\/jussbeautifulhair1/);
  assert.match(handoff, /historical/i);
  assert.match(handoff, /must not deploy `jbh-contact-ingress`/i);
  assert.match(handoff, /64ea67290e161debdae5cb9a9e3f8f27fab4842b/);
  assert.match(handoff, /not authorized/i);
  assert.doesNotMatch(handoff, /private PR #6/i);
});
