import assert from "node:assert/strict";
import test from "node:test";

import {
  assertApprovedCheckoutRedirect,
  CHECKOUT_REDIRECT_CONTRACT,
} from "../client/src/lib/checkoutRedirect.mjs";

const accepted = [
  "https://checkout.stripe.com/c/pay/cs_test_123",
  "https://checkout.stripe.com/c/pay/cs_live_123#fidkdWxOYHwnPyd1blpxYHZxWjA0",
];

const rejected = [
  undefined,
  null,
  "",
  "not-a-url",
  "http://checkout.stripe.com/c/pay/cs_test_123",
  "https://checkout.stripe.com.evil.example/c/pay/cs_test_123",
  "https://buy.stripe.com/test_link",
  "https://stripe.com/c/pay/cs_test_123",
  "https://user:pass@checkout.stripe.com/c/pay/cs_test_123",
  "https://checkout.stripe.com:8443/c/pay/cs_test_123",
  "https://evil.example/c/pay/cs_test_123",
];

test("accepts only the exact hosted Stripe Checkout origin", () => {
  for (const value of accepted) {
    assert.equal(assertApprovedCheckoutRedirect(value), new URL(value).toString());
  }

  assert.deepEqual(CHECKOUT_REDIRECT_CONTRACT, {
    origin: "https://checkout.stripe.com",
    protocol: "https:",
    credentialsAllowed: false,
    customPortAllowed: false,
  });
});

test("fails closed for malformed, insecure, credentialed, ported, and lookalike URLs", () => {
  for (const value of rejected) {
    assert.throws(
      () => assertApprovedCheckoutRedirect(value),
      /Checkout (did not return|returned|redirect was blocked)/,
      String(value),
    );
  }
});
