import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(path, "utf8");

test("newsletter activation requires an explicit endpoint on the CSP-authorized ingress", async () => {
  const source = await read("client/src/lib/privateIngress.ts");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  const { resolveNewsletterEndpoint } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
  const contact = "https://ingress.jbh.invalid/contact";
  assert.equal(resolveNewsletterEndpoint(undefined, contact), null);
  assert.equal(resolveNewsletterEndpoint("https://ingress.jbh.invalid/newsletter", undefined), null);
  assert.equal(resolveNewsletterEndpoint("https://other.invalid/newsletter", contact), null);
  assert.equal(resolveNewsletterEndpoint("http://ingress.jbh.invalid/newsletter", contact), null);
  assert.equal(resolveNewsletterEndpoint("https://ingress.jbh.invalid/contact", contact), null);
  assert.equal(resolveNewsletterEndpoint("https://user:secret@ingress.jbh.invalid/newsletter", contact), null);
  assert.equal(
    resolveNewsletterEndpoint("https://ingress.jbh.invalid/newsletter?token=unused#fragment", contact),
    "https://ingress.jbh.invalid/newsletter",
  );
});

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
