import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("newsletter signup fails closed and uses the private customer-data ingress", async () => {
  const [home, ingress, turnstile, worker, privacy] = await Promise.all([
    read("client/src/pages/Home.tsx"),
    read("client/src/lib/privateIngress.ts"),
    read("client/src/components/TurnstileChallenge.tsx"),
    read("worker/index.ts"),
    read("client/src/pages/Privacy.tsx"),
  ]);

  assert.doesNotMatch(home, /apiRequest\("POST", "\/api\/newsletter"/);
  assert.doesNotMatch(worker, /newsletter_subscribers|\/api\/newsletter/);

  assert.match(home, /getNewsletterEndpoint/);
  assert.match(home, /newsletterConfigured/);
  assert.match(home, /consent: newsletterConsent/);
  assert.match(home, /turnstileToken/);
  assert.match(home, /companyWebsite/);
  assert.match(home, /action="newsletter"/);
  assert.match(home, /checkbox-newsletter-consent/);
  assert.match(home, /newsletter-unavailable/);
  assert.match(home, /result\.subscribed/);
  assert.match(home, /window\.turnstile\?\.reset\(\)/);
  assert.match(home, /Privacy Policy/);

  assert.match(ingress, /VITE_CONTACT_API_URL/);
  assert.match(ingress, /configured\.pathname = "\/newsletter"/);
  assert.match(ingress, /configured\.search = ""/);
  assert.match(ingress, /configured\.hash = ""/);
  assert.match(turnstile, /"contact" \| "newsletter"/);

  assert.match(privacy, /marketing updates/i);
  assert.match(privacy, /unsubscribe/i);
});
