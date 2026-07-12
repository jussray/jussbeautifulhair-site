import { test, expect } from '@playwright/test';

test('installs public storefront vision and guardrails', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('html')).toHaveAttribute('data-guardrails', 'active');
  await expect(page.locator('html')).toHaveAttribute('data-product-stage', 'live-storefront');

  const snapshot = await page.evaluate(() => window.__JBH_GUARDRAILS__);
  expect(snapshot?.vision.id).toBe('trusted-hair-commerce');
  expect(snapshot?.publicAdminSurface).toBe(false);
  expect(snapshot?.secretsInClient).toBe(false);
  expect(snapshot?.guardrails.map(item => item.id)).toEqual(expect.arrayContaining([
    'JBH-TRUTH-001',
    'JBH-CHECKOUT-001',
    'JBH-SECRET-001',
    'JBH-POLICY-001'
  ]));
});

test('checkout redirect validation accepts Stripe and rejects lookalikes', async ({ page }) => {
  await page.goto('/#/');
  const outcomes = await page.evaluate(async () => {
    const { assertApprovedCheckoutUrl } = await import('/src/config/visionGuardrails.ts');
    const check = (value: string) => {
      try {
        return assertApprovedCheckoutUrl(value);
      } catch (error) {
        return error instanceof Error ? error.message : 'blocked';
      }
    };
    return {
      checkout: check('https://checkout.stripe.com/c/pay/cs_test_123'),
      paymentLink: check('https://buy.stripe.com/test_123'),
      insecure: check('http://checkout.stripe.com/c/pay/test'),
      lookalike: check('https://checkout.stripe.com.evil.example/pay'),
      arbitrary: check('https://example.com/pay')
    };
  });

  expect(outcomes.checkout).toContain('checkout.stripe.com');
  expect(outcomes.paymentLink).toContain('buy.stripe.com');
  expect(outcomes.insecure).toContain('blocked');
  expect(outcomes.lookalike).toContain('blocked');
  expect(outcomes.arbitrary).toContain('blocked');
});

test('public policy routes remain reachable and admin controls remain absent', async ({ page }) => {
  for (const route of ['shipping', 'returns', 'privacy', 'terms', 'contact']) {
    await page.goto(`/#/${route}`);
    await expect(page.locator('body')).not.toBeEmpty();
  }

  await page.goto('/#/');
  await expect(page.getByRole('link', { name: /admin/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /admin|refund order|rotate secret/i })).toHaveCount(0);
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SUPPLIER_PASSWORD|sk_(live|test)_/i);
});

test('mobile storefront does not overflow horizontally', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'));
  await page.goto('/#/');
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});
