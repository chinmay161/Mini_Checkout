# Test Plan: Mini Checkout and Browser Test Suite

## 1. Scope and Approach

### 1.1 In Scope
- **Client-Side Functional Checkout**: Cart management, dynamic line item additions, quantity modification (1–99), removal of line items, dynamic total recalculations.
- **Form Validation & Accessibility**: Client-side name trimming, required field enforcement, empty cart prevention, ARIA live alerts (`role="alert"`), `aria-invalid`, `aria-describedby`, and programmatic focus placement.
- **Order Placement & Idempotency**: Synchronous double-submit guards, unique reference format validation (`ORD-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}`), customer and item summary rendering.
- **State Reset**: "Start new order" clearing cart state, input fields, and returning to a clean UI state.
- **Edge Conditions & Layout Resiliency**: Rapid multi-clicks, short-window layout shifts, mid-typing quantity behavior, blur reversions, XSS injection prevention, unbroken string wrapping, and keyboard Enter form submissions.

### 1.2 Out of Scope
- Backend databases, order persistence APIs, or external network requests.
- Payment processing gateways, credit card validation, or shipping calculation services.
- Cross-browser automation beyond Chromium (Firefox, WebKit).
- User authentication, session storage, cookies, or local storage.

---

## 2. Risk Register

| Priority | Risk Description | Rationale |
| :--- | :--- | :--- |
| **High** | Wrong totals (price/quantity math) | Inaccurate pricing undermines buyer trust and violates basic commercial accounting. |
| **High** | Order placed with empty cart or blank name | Unfulfillable or anonymous orders pollute the business process. |
| **High** | Duplicate order/confirmation on double submit | Rapid clicking can trigger multiple submissions, generating duplicate orders or phantom charges. |
| **Medium** | Confirmation lost after rapid double-click (layout shift) | Hiding checkout view shifts "Start new order" under the cursor, resetting the app to an empty store. |
| **Medium** | Customer input lost on validation failure | Resetting or clearing user input upon validation error frustrates customers and causes drop-off. |
| **Medium** | Invalid quantity input (`0`, empty, `100`, `NaN`) | Invalid quantities break line calculations or lead to invalid cart states. |
| **Medium** | Whitespace-only name bypasses validation | Strings containing only spaces bypass naive length checks without identifying the customer. |
| **Medium** | Stale state after "Start new order" | Lingering data from a previous order corrupts subsequent checkout workflows. |
| **Low** | Focus and ARIA announcement failures | Keyboard and screen-reader users lose context if error alerts or confirmation headings are not focused. |
| **Low** | HTML injection through the name field | Unsanitized input rendered in order confirmation could execute arbitrary scripts (XSS). |
| **Low** | Long unbroken name text overflow | Extremely long unbroken strings (e.g., 100+ character words) can break container boundaries on narrow screens. |
| **Low** | Enter key submission failure | Keyboard users expect submitting via Enter from input fields to place the order once. |
| **Low** | Error alerts not clearing dynamically | Lingering validation errors confuse customers once inputs have been corrected. |
| **Low** | Multi-item summary inaccuracies | Confirmation card itemized list must accurately reflect all line items, quantities, and composite total. |

---

## 3. Coverage Matrix

| Risk / Requirement | Automated Test(s) | Manual Test(s) | Status |
| :--- | :--- | :--- | :--- |
| **Wrong totals** | `changing quantities updates line totals and the exact order total` | — | Covered |
| **Empty cart order** | `empty cart blocks checkout`<br>`empty cart and blank name show both messages and focus the first problem` | `MT-1` | Covered |
| **Blank / whitespace name** | `missing name blocks checkout and keeps the cart`<br>`empty cart and blank name show both messages and focus the first problem` | — | Covered |
| **Duplicate order on submit** | `double submit produces exactly one confirmation`<br>`scripted rapid submits still produce one confirmation` | `MT-2a`, `MT-2b` | Covered |
| **Confirmation lost (DEF-001)** | `rapid double-click on Place Order in a short window keeps the confirmation`<br>`rapid triple-click on Place Order in a short window keeps the confirmation` | `MT-3` | Covered |
| **Customer input lost** | `missing name blocks checkout and keeps the cart`<br>`empty cart blocks checkout` | `MT-1` | Covered |
| **Invalid quantity input** | `invalid quantity reverts to the last valid value` | — | Covered (+ Mutation M6) |
| **Stale state on reset** | `remove and start-new-order reset` | — | Covered |
| **Focus and ARIA handling** | `successful checkout shows a single order confirmation with a reference`<br>`missing name blocks checkout and keeps the cart`<br>`empty cart and blank name show both messages and focus the first problem` | — | Covered |
| **HTML injection in name** | `customer name is shown as text and never rendered as HTML` | — | Covered (+ Mutation M3) |
| **Long unbroken name overflow** | `a very long unbroken name stays inside the confirmation card` | — | Covered (+ Mutation M4) |
| **Enter key submit** | `pressing Enter in the name field places the order once` | — | Covered |
| **Error messages clear as customer fixes input** | `errors clear as the customer fixes them` | — | Covered (+ Mutation M5) |
| **Confirmation lists ordered items and total for a multi-item order** | `pressing Enter in the name field places the order once` | — | Covered |

---

## 4. Automated Test Specifications

All automated tests are located in [`tests/checkout.spec.js`](../tests/checkout.spec.js).

### Test TC-01: Successful Checkout Shows Single Order Confirmation with Reference
- **Title**: `successful checkout shows a single order confirmation with a reference`
- **Steps**:
  1. Click "Add to cart" on Canvas Notebook.
  2. Fill `#name-input` with `'  Asha Rao  '`.
  3. Click "Place Order".
- **Expected Results**:
  - Exactly 1 confirmation block is visible.
  - Order reference matches `/^ORD-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/`.
  - Customer name displays trimmed `'Asha Rao'`.
  - Total displays `'$12.50'`.
  - Checkout form, products, and add buttons are no longer visible.
  - Confirmation heading `<h2>Order confirmed</h2>` is focused.
- **Key Assertions**:
  ```javascript
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveText(/^ORD-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
  await expect(page.getByTestId('confirmation-name')).toHaveText('Asha Rao');
  await expect(page.getByTestId('confirmation-total')).toHaveText('$12.50');
  await expect(page.getByTestId('product-notebook')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeFocused();
  ```

### Test TC-02: Missing Name Blocks Checkout and Keeps the Cart
- **Title**: `missing name blocks checkout and keeps the cart`
- **Steps**:
  1. Click "Add to cart" on Gel Pen Set.
  2. Fill `#name-input` with whitespace `'   '`.
  3. Click "Place Order".
  4. Fill `#name-input` with valid name `'Asha Rao'`.
- **Expected Results**:
  - `#name-error` displays `'Please enter your full name.'`.
  - `#name-input` has `aria-invalid="true"`.
  - Confirmation count is `0`.
  - Whitespace value in name field is preserved.
  - Cart line items and total remain intact (`$4.99`).
  - Typing valid name removes `#name-error` and clears `aria-invalid`.
- **Key Assertions**:
  ```javascript
  await expect(page.getByTestId('name-error')).toBeVisible();
  await expect(page.getByTestId('name-error')).toHaveText('Please enter your full name.');
  await expect(page.getByTestId('name-input')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('name-error')).toHaveCount(0);
  await expect(page.getByTestId('name-input')).not.toHaveAttribute('aria-invalid');
  ```

### Test TC-03: Changing Quantities Updates Line Totals and Order Total
- **Title**: `changing quantities updates line totals and the exact order total`
- **Steps**:
  1. Add Notebook ($12.50) and Pens ($4.99).
  2. Type `'3'` in Notebook quantity input.
  3. Type `'2'` in Pens quantity input.
  4. Click decrement button (`-`) on Pens.
- **Expected Results**:
  - Notebook line total becomes `'$37.50'`.
  - Pens line total becomes `'$9.98'`, order total becomes `'$47.48'`.
  - Decrementing Pens drops qty to 1, line total to `'$4.99'`, order total to `'$42.49'`.
- **Key Assertions**:
  ```javascript
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$37.50');
  await expect(page.getByTestId('line-total-pens')).toHaveText('$9.98');
  await expect(page.getByTestId('order-total')).toHaveText('$47.48');
  await expect(page.getByTestId('line-total-pens')).toHaveText('$4.99');
  await expect(page.getByTestId('order-total')).toHaveText('$42.49');
  ```

### Test TC-04: Empty Cart Blocks Checkout
- **Title**: `empty cart blocks checkout`
- **Steps**:
  1. Fill name `'Asha Rao'` with an empty cart.
  2. Click "Place Order".
- **Expected Results**:
  - `#cart-error` displays `'Your cart is empty. Add at least one item before placing your order.'`.
  - Confirmation count is `0`.
  - Name input retains `'Asha Rao'`.
- **Key Assertions**:
  ```javascript
  await expect(page.getByTestId('cart-error')).toBeVisible();
  await expect(page.getByTestId('cart-error')).toHaveText('Your cart is empty. Add at least one item before placing your order.');
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('name-input')).toHaveValue('Asha Rao');
  ```

### Test TC-05: Double Submit Produces Exactly One Confirmation
- **Title**: `double submit produces exactly one confirmation`
- **Steps**:
  1. Add Canvas Notebook, fill name `'Asha Rao'`.
  2. Rapidly double-click "Place Order" via `.dblclick()`.
- **Expected Results**:
  - Exactly 1 confirmation block rendered.
  - Exactly 1 order reference rendered matching the regex.
- **Key Assertions**:
  ```javascript
  await page.getByTestId('place-order').dblclick();
  await expect(page.getByTestId('order-reference')).toHaveText(/^ORD-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveCount(1);
  ```

### Test TC-06: Scripted Rapid Submits Still Produce One Confirmation
- **Title**: `scripted rapid submits still produce one confirmation`
- **Steps**:
  1. Add Canvas Notebook, fill name `'Asha Rao'`.
  2. In a single synchronous `page.evaluate()`, click `#place-order`, read first order reference, click `#place-order` again, call `form.requestSubmit()` twice, and read subsequent reference and confirmation count.
- **Expected Results**:
  - First reference matches `ORD-` regex.
  - Reference after rapid attempts is strictly identical to first reference (`result.after === result.first`).
  - Total confirmation count is exactly 1.
- **Key Assertions**:
  ```javascript
  expect(result.first).toMatch(ordRegex);
  expect(result.after).toBe(result.first);
  expect(result.count).toBe(1);
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveText(result.first);
  ```

### Test TC-07: Invalid Quantity Reverts to the Last Valid Value
- **Title**: `invalid quantity reverts to the last valid value`
- **Steps**:
  1. Add Canvas Notebook (qty 1, total $12.50).
  2. Fill qty input with `'0'`; assert total is still `'$12.50'`. Blur via `Tab`; assert qty value reverts to `'1'` and total remains `'$12.50'`.
  3. Fill qty input with `'100'`; assert total is still `'$12.50'`. Blur via `Tab`; assert qty value reverts to `'1'` and total remains `'$12.50'`.
  4. Assert body does not contain `'NaN'`.
- **Expected Results**:
  - Mid-typing invalid values does not change order total.
  - On blur, value reverts to last valid integer (`'1'`).
  - No `NaN` text anywhere on the page.
- **Key Assertions**:
  ```javascript
  await page.getByTestId('qty-notebook').fill('0');
  await expect(page.getByTestId('order-total')).toHaveText('$12.50');
  await page.getByTestId('qty-notebook').press('Tab');
  await expect(page.getByTestId('qty-notebook')).toHaveValue('1');
  await expect(page.getByTestId('order-total')).toHaveText('$12.50');

  await page.getByTestId('qty-notebook').fill('100');
  await expect(page.getByTestId('order-total')).toHaveText('$12.50');
  await page.getByTestId('qty-notebook').press('Tab');
  await expect(page.getByTestId('qty-notebook')).toHaveValue('1');
  await expect(page.getByTestId('order-total')).toHaveText('$12.50');

  await expect(page.locator('body')).not.toContainText('NaN');
  ```

### Test TC-08: Remove and Start-New-Order Reset
- **Title**: `remove and start-new-order reset`
- **Steps**:
  1. Add Notebook, click "Remove".
  2. Add Notebook, fill name `'Asha Rao'`, place order.
  3. Click "Start new order".
  4. Add Gel Pen Set, fill name `'Rao Asha'`, place second order.
- **Expected Results**:
  - Remove clears cart, shows "Your cart is empty", total `'$0.00'`.
  - "Start new order" resets cart to empty, name to blank, removes confirmation.
  - Subsequent order completes successfully with updated name and total (`'$4.99'`).
- **Key Assertions**:
  ```javascript
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');
  await page.getByTestId('new-order').click();
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('confirmation-name')).toHaveText('Rao Asha');
  await expect(page.getByTestId('confirmation-total')).toHaveText('$4.99');
  ```

### Test TC-09: Empty Cart and Blank Name Show Both Messages and Focus First Problem
- **Title**: `empty cart and blank name show both messages and focus the first problem`
- **Steps**:
  1. On a fresh page, click "Place Order" without adding items or entering a name.
- **Expected Results**:
  - Both `#cart-error` and `#name-error` appear simultaneously.
  - First problem in visual DOM order (`#cart-error`) receives focus.
  - Confirmation is not created.
- **Key Assertions**:
  ```javascript
  await expect(page.getByTestId('cart-error')).toBeVisible();
  await expect(page.getByTestId('name-error')).toBeVisible();
  await expect(page.getByTestId('cart-error')).toBeFocused();
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  ```

### Test TC-10: Rapid Double-Click on Place Order in a Short Window Keeps Confirmation
- **Title**: `rapid double-click on Place Order in a short window keeps the confirmation`
- **Steps**:
  1. Set viewport to 1280x500.
  2. Add Canvas Notebook, fill name `'Asha Rao'`.
  3. Scroll to page bottom, calculate bounding box center of `#place-order`.
  4. Perform `await page.mouse.dblclick(x, y)`.
- **Expected Results**:
  - Exactly 1 confirmation block remains visible.
  - App does not reset to empty cart.
- **Key Assertions**:
  ```javascript
  await page.mouse.dblclick(x, y);
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveText(/^ORD-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
  await expect(page.getByTestId('cart-empty-message')).not.toBeVisible();
  await expect(page.getByTestId('order-total')).not.toBeVisible();
  ```

### Test TC-11: Rapid Triple-Click on Place Order in a Short Window Keeps Confirmation
- **Title**: `rapid triple-click on Place Order in a short window keeps the confirmation`
- **Steps**:
  1. Set viewport to 1280x500, add Notebook, fill name `'Asha Rao'`.
  2. Scroll to bottom, calculate center of `#place-order`.
  3. Perform 3 consecutive `page.mouse.click(x, y)` calls.
- **Expected Results**:
  - Exactly 1 confirmation rendered.
  - App does not reset to empty cart.
- **Key Assertions**:
  ```javascript
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveText(/^ORD-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
  ```

### Test TC-12: Customer Name is Shown as Text and Never Rendered as HTML
- **Title**: `customer name is shown as text and never rendered as HTML`
- **Steps**:
  1. Load page, add Canvas Notebook.
  2. Fill name with `'  <img src=x onerror="window.__xss=1">Asha   '`.
  3. Click "Place Order".
- **Expected Results**:
  - Customer name renders exactly as text `<img src=x onerror="window.__xss=1">Asha`.
  - Zero `img` elements exist inside the confirmation card.
  - `window.__xss` evaluates to `undefined` (script never executed).
- **Key Assertions**:
  ```javascript
  await expect(page.getByTestId('confirmation-name')).toHaveText('<img src=x onerror="window.__xss=1">Asha');
  await expect(page.locator('[data-testid="confirmation"] img')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__xss)).toBeUndefined();
  ```

### Test TC-13: A Very Long Unbroken Name Stays Inside the Confirmation Card
- **Title**: `a very long unbroken name stays inside the confirmation card`
- **Steps**:
  1. Set viewport to 390x844 (mobile portrait).
  2. Add Canvas Notebook.
  3. Fill name with `'A'.repeat(200)`.
  4. Click "Place Order".
  5. Measure bounding boxes of `#confirmation-name` and `#confirmation`.
- **Expected Results**:
  - The name breaks and wraps within the card container boundaries.
  - `nameBox.x + nameBox.width <= cardBox.x + cardBox.width + 1`.
- **Key Assertions**:
  ```javascript
  const nameBox = await page.getByTestId('confirmation-name').boundingBox();
  const cardBox = await page.getByTestId('confirmation').boundingBox();
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
  ```

### Test TC-14: Pressing Enter in the Name Field Places the Order Once
- **Title**: `pressing Enter in the name field places the order once`
- **Steps**:
  1. Add Canvas Notebook and Gel Pen Set.
  2. Set Notebook quantity to 2.
  3. Fill name input with `'Asha Rao'`.
  4. Press `Enter` inside the name input field.
- **Expected Results**:
  - Exactly 1 confirmation rendered.
  - Item list contains `'Canvas Notebook × 2'` and `'Gel Pen Set × 1'`.
  - Confirmation total displays `'$29.99'` (2 × 12.50 + 4.99).
  - Order reference matches `ORD-` regex pattern.
- **Key Assertions**:
  ```javascript
  await page.getByTestId('name-input').press('Enter');
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('confirmation')).toContainText('Canvas Notebook × 2');
  await expect(page.getByTestId('confirmation')).toContainText('Gel Pen Set × 1');
  await expect(page.getByTestId('confirmation-total')).toHaveText('$29.99');
  await expect(page.getByTestId('order-reference')).toHaveText(/^ORD-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
  ```

### Test TC-15: Errors Clear as the Customer Fixes Them
- **Title**: `errors clear as the customer fixes them`
- **Steps**:
  1. On a fresh page, click "Place Order" to trigger `#cart-error` and `#name-error`.
  2. Fill name with `'   '` (whitespace only); assert `#name-error` remains visible.
  3. Fill name with `'Asha Rao'`; assert `#name-error` disappears and `aria-invalid` is removed, but `#cart-error` remains visible.
  4. Click "Add to cart" on Notebook; assert `#cart-error` disappears.
  5. Click "Place Order"; assert order confirmation appears.
- **Key Assertions**:
  ```javascript
  await page.getByTestId('name-input').fill('   ');
  await expect(page.getByTestId('name-error')).toBeVisible();
  await page.getByTestId('name-input').fill('Asha Rao');
  await expect(page.getByTestId('name-error')).toHaveCount(0);
  await expect(page.getByTestId('name-input')).not.toHaveAttribute('aria-invalid');
  await expect(page.getByTestId('cart-error')).toBeVisible();
  await page.getByTestId('add-notebook').click();
  await expect(page.getByTestId('cart-error')).toHaveCount(0);
  await page.getByTestId('place-order').click();
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  ```

---

## 5. Manual Test Cases

### MT-1: Empty Cart Validation
- **Environment**: Desktop Chrome (157.0.8103.80).
- **Steps**:
  1. Load application at `http://localhost:3000`.
  2. Type `"Chinmay Wankhede"` into the Full Name field. Leave cart empty.
  3. Click "Place Order".
- **Expected Results**:
  - Cart error `"Your cart is empty. Add at least one item before placing your order."` is displayed with a highlighted red border.
  - No confirmation appears.
  - Name input value `"Chinmay Wankhede"` is preserved.
  - Order total remains `"$0.00"`.

### MT-2: Rapid Double-Click Under Standard Viewports
- **MT-2a (Desktop)**:
  1. In desktop browser, add Canvas Notebook ($12.50).
  2. Enter `"Chinmay Wankhede"`.
  3. Double-click "Place Order" rapidly.
  4. Verify exactly one confirmation is shown with total `"$12.50"`, order reference `ORD-...`, and console check `document.querySelectorAll('[data-testid="confirmation"]').length === 1`.
- **MT-2b (Phone Viewport / DevTools Device Mode)**:
  1. Enable DevTools Device Mode (e.g. 375x667 mobile screen).
  2. Add Gel Pen Set ($4.99), enter `"Chinmay Wankhede"`.
  3. Tap/click "Place Order" rapidly twice.
  4. Verify exactly one confirmation is displayed with total `"$4.99"` and confirmation count is 1.

### MT-3: Defect DEF-001 Reproduction (Short Window Layout Shift)
- **Environment**: Desktop Chrome, viewport resized to 1280x500.
- **Steps**:
  1. Load app, add Canvas Notebook, enter customer name.
  2. Scroll page to the very bottom so "Place Order" sits near the bottom margin (around y=430).
  3. Double-click "Place Order".
- **Expected Results (Fixed Code)**:
  - Click 1 places the order and renders the confirmation card.
  - The "Start new order" button is disabled for 600 ms, absorbing the second click.
  - Confirmation card remains displayed (`document.querySelectorAll('[data-testid="confirmation"]').length === 1`).

---

## 6. Entry and Exit Criteria & Defect Reporting

### 6.1 Entry Criteria
- Zero-dependency Node.js static server starts cleanly on port 3000/3100.
- Public client files (`index.html`, `styles.css`, `app.js`) pass structural and syntax checks.
- Playwright Chromium test runner is installed and initialized.

### 6.2 Exit Criteria
- 100% of the 15 automated test cases pass in `npm test`.
- Stress test `npx playwright test --repeat-each=5` completes with 75/75 passes (0 flakes).
- Single-worker isolation test `npx playwright test --workers=1` completes with 15/15 passes.
- Exploratory probe `npm run probe` completes with `CONFIRMATION_LOST: 0`.
- All 6 mutation checks (M1 through M6) fail as expected against modified application code and restore cleanly.
- Manual verification scenarios MT-1, MT-2a, MT-2b, and MT-3 pass.

### 6.3 Defect Reporting Protocol
When a defect is identified:
1. Document unique ID (e.g., `DEF-001`), title, severity, and environment.
2. Record preconditions, exact reproduction steps, and expected vs. actual outcomes.
3. Capture visual artifacts (failure screenshot, Playwright trace).
4. Author a failing automated regression test first to prove defect presence (Red).
5. Apply isolated fix in application code and verify regression test passes (Green).
6. Document root-cause analysis and residual risk in [TEST_RESULTS.md](TEST_RESULTS.md).

---

## 7. Known limitations of the tests
- Playwright's `fill()` does not emit individual key events (`keydown`, `keypress`, `keyup`) that an end-user typing keystroke-by-keystroke generates.
- The short-window regression tests (TC-10, TC-11) depend on page geometry at 1280x500 and on the 600 ms window and must be re-checked against the baseline after any layout change.
- The 600 ms threshold is assumed, not measured.
- Absence of `localStorage`, `sessionStorage`, and cookies is confirmed by code inspection, not by a test.
