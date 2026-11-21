const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
  await expect(page.getByTestId('name-input')).toHaveValue('');
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('cart-error')).toHaveCount(0);
  await expect(page.getByTestId('name-error')).toHaveCount(0);
});

test('successful checkout shows a single order confirmation with a reference', async ({ page }) => {
  await page.getByTestId('add-notebook').click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$12.50');
  await expect(page.getByTestId('order-total')).toHaveText('$12.50');

  await page.getByTestId('name-input').fill('  Asha Rao  ');
  await expect(page.getByTestId('name-input')).toHaveValue('  Asha Rao  ');

  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('confirmation')).toBeVisible();
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveText(/^ORD-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
  await expect(page.getByTestId('confirmation-name')).toHaveText('Asha Rao');
  await expect(page.getByTestId('confirmation-total')).toHaveText('$12.50');
  await expect(page.getByTestId('checkout-form')).not.toBeVisible();
  await expect(page.getByTestId('place-order')).not.toBeVisible();
  await expect(page.getByTestId('product-notebook')).not.toBeVisible();
  await expect(page.getByTestId('add-notebook')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeFocused();
});

test('missing name blocks checkout and keeps the cart', async ({ page }) => {
  await page.getByTestId('add-pens').click();
  await expect(page.getByTestId('cart-line-pens')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$4.99');

  await page.getByTestId('name-input').fill('   ');
  await expect(page.getByTestId('name-input')).toHaveValue('   ');

  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('name-error')).toBeVisible();
  await expect(page.getByTestId('name-error')).toHaveText('Please enter your full name.');
  await expect(page.getByTestId('name-input')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('name-input')).toHaveValue('   ');
  await expect(page.getByTestId('cart-line-pens')).toBeVisible();
  await expect(page.getByTestId('qty-pens')).toHaveValue('1');
  await expect(page.getByTestId('order-total')).toHaveText('$4.99');

  await page.getByTestId('name-input').fill('Asha Rao');
  await expect(page.getByTestId('name-error')).toHaveCount(0);
  await expect(page.getByTestId('name-input')).not.toHaveAttribute('aria-invalid');
});

test('changing quantities updates line totals and the exact order total', async ({ page }) => {
  await page.getByTestId('add-notebook').click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();

  await page.getByTestId('add-pens').click();
  await expect(page.getByTestId('cart-line-pens')).toBeVisible();

  await page.getByTestId('qty-notebook').fill('3');
  await expect(page.getByTestId('qty-notebook')).toHaveValue('3');
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$37.50');

  await page.getByTestId('qty-pens').fill('2');
  await expect(page.getByTestId('qty-pens')).toHaveValue('2');
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$37.50');
  await expect(page.getByTestId('line-total-pens')).toHaveText('$9.98');
  await expect(page.getByTestId('order-total')).toHaveText('$47.48');

  await page.getByTestId('qty-dec-pens').click();
  await expect(page.getByTestId('qty-pens')).toHaveValue('1');
  await expect(page.getByTestId('line-total-pens')).toHaveText('$4.99');
  await expect(page.getByTestId('order-total')).toHaveText('$42.49');
});

test('empty cart blocks checkout', async ({ page }) => {
  await page.getByTestId('name-input').fill('Asha Rao');
  await expect(page.getByTestId('name-input')).toHaveValue('Asha Rao');

  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('cart-error')).toBeVisible();
  await expect(page.getByTestId('cart-error')).toHaveText('Your cart is empty. Add at least one item before placing your order.');
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('name-input')).toHaveValue('Asha Rao');
});

test('double submit produces exactly one confirmation', async ({ page }) => {
  await page.getByTestId('add-notebook').click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();

  await page.getByTestId('name-input').fill('Asha Rao');
  await expect(page.getByTestId('name-input')).toHaveValue('Asha Rao');

  // Realistic user gesture: rapid double-click on the submit button.
  // The synchronous double-submit guard itself is proven by the scripted test below.
  await page.getByTestId('place-order').dblclick();

  await expect(page.getByTestId('order-reference')).toHaveText(/^ORD-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveCount(1);
});

test('scripted rapid submits still produce one confirmation', async ({ page }) => {
  await page.getByTestId('add-notebook').click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();

  await page.getByTestId('name-input').fill('Asha Rao');
  await expect(page.getByTestId('name-input')).toHaveValue('Asha Rao');

  // The app renders synchronously upon valid submission, so reading DOM synchronously within page.evaluate detects any regenerated reference
  const result = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="place-order"]');
    const form = document.querySelector('[data-testid="checkout-form"]');

    btn.click();
    const first = document.querySelector('[data-testid="order-reference"]')?.textContent ?? '';

    btn.click();
    form.requestSubmit();
    form.requestSubmit();

    const after = document.querySelector('[data-testid="order-reference"]')?.textContent ?? '';
    const count = document.querySelectorAll('[data-testid="confirmation"]').length;

    return { first, after, count };
  });

  const ordRegex = /^ORD-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/;
  expect(result.first).toMatch(ordRegex);
  expect(result.after).toBe(result.first);
  expect(result.count).toBe(1);

  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveText(result.first);
});

test('invalid quantity reverts to the last valid value', async ({ page }) => {
  await page.getByTestId('add-notebook').click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();
  await expect(page.getByTestId('qty-notebook')).toHaveValue('1');

  // Mid-typing "0" must not change the cart
  await page.getByTestId('qty-notebook').fill('0');
  await expect(page.getByTestId('order-total')).toHaveText('$12.50');
  await page.getByTestId('qty-notebook').press('Tab');
  await expect(page.getByTestId('qty-notebook')).toHaveValue('1');
  await expect(page.getByTestId('order-total')).toHaveText('$12.50');

  // Mid-typing "100" must not change the cart
  await page.getByTestId('qty-notebook').fill('100');
  await expect(page.getByTestId('order-total')).toHaveText('$12.50');
  await page.getByTestId('qty-notebook').press('Tab');
  await expect(page.getByTestId('qty-notebook')).toHaveValue('1');
  await expect(page.getByTestId('order-total')).toHaveText('$12.50');

  await expect(page.locator('body')).not.toContainText('NaN');
});

test('remove and start-new-order reset', async ({ page }) => {
  await page.getByTestId('add-notebook').click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();

  await page.getByTestId('remove-notebook').click();
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');

  await page.getByTestId('add-notebook').click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();
  await page.getByTestId('name-input').fill('Asha Rao');
  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('confirmation')).toBeVisible();

  await page.getByTestId('new-order').click();
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');
  await expect(page.getByTestId('name-input')).toHaveValue('');
  await expect(page.getByTestId('confirmation')).toHaveCount(0);

  // Assert that a second order can be placed cleanly
  await page.getByTestId('add-pens').click();
  await expect(page.getByTestId('cart-line-pens')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$4.99');
  await page.getByTestId('name-input').fill('Rao Asha');
  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('confirmation')).toBeVisible();
  await expect(page.getByTestId('confirmation-name')).toHaveText('Rao Asha');
  await expect(page.getByTestId('confirmation-total')).toHaveText('$4.99');
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
});

test('empty cart and blank name show both messages and focus the first problem', async ({ page }) => {
  await page.getByTestId('place-order').click();

  await expect(page.getByTestId('cart-error')).toBeVisible();
  await expect(page.getByTestId('cart-error')).toHaveText(
    'Your cart is empty. Add at least one item before placing your order.'
  );
  await expect(page.getByTestId('name-error')).toBeVisible();
  await expect(page.getByTestId('name-error')).toHaveText('Please enter your full name.');
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('cart-error')).toBeFocused();
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');
});
