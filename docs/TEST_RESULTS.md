# Test Results: Mini Checkout and Browser Test Suite

## 1. Environment

| Component | Value / Version |
| :--- | :--- |
| **Operating System** | Microsoft Windows [Version 10.0.26300.10075] |
| **Node.js** | v24.4.1 (Playwright engine requirement: `>=20` from `node_modules/@playwright/test/package.json`) |
| **npm** | 11.4.2 |
| **Playwright** | Version 1.65.1 |
| **Automated Browser** | Chromium 159.0.8154.6 (Playwright managed) |
| **Tester's Manual Browser** | Google Chrome 157.0.8103.80 (Executed 21-11-2026 ~20:33) |

---

## 2. Automated Test Execution Results

The automated test suite was executed across multiple worker configurations and repeat runs. Real test counts copied from the evidence files:

| Test Run Type | Command | Total Tests | Passed | Failed | Flakes | Evidence File |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Full Test Suite** | `npm test` | 15 | 15 | 0 | 0 | [evidence/automated/npm-test.txt](../evidence/automated/npm-test.txt) |
| **Stability Run** | `npx playwright test --repeat-each=5` | 75 | 75 | 0 | 0 | [evidence/automated/repeat-each-5.txt](../evidence/automated/repeat-each-5.txt) |
| **Isolation Run** | `npx playwright test --workers=1` | 15 | 15 | 0 | 0 | [evidence/automated/workers-1.txt](../evidence/automated/workers-1.txt) |

### 2.1 Exploratory Probe Results
The exploratory layout probe executes a matrix of viewports, vertical click coordinates, and click modes using real mouse input (`page.mouse`):
- **Command**: `npm run probe`
- **Output Totals**:
  - `ONE_CONFIRMATION`: 152
  - `CONFIRMATION_LOST`: 0
  - `MULTIPLE`: 0
  - `OTHER`: 0
  - `TOTAL ATTEMPTS`: 152
  - `DISTINCT SCENARIOS TESTED`: 22
- **Evidence File**: [evidence/automated/probe.txt](../evidence/automated/probe.txt)

> **Plain-language note on probe coverage**: The 152 probe rows overstate independent coverage because requested Y coordinates frequently clamp to the page scroll boundary (`document.body.scrollHeight`). On short pages or small viewports, multiple requested Y values target the exact same bottom position (actual coordinates). The probe is a diagnostic measurement tool rather than a release gate, and these numbers accurately reflect the live hit-testing behavior of the layout after the DEF-001 fix.

---

## 3. Mutation Checks

Six mutations were applied across `public/app.js` and `public/styles.css` to verify that the test suite detects critical regressions.

### Mutation M1: Submit Guard Removal
- **Change**: Commented out the early double-submit guard in `public/app.js`:
  ```javascript
  // if (orderPlaced || isSubmitting) {
  //   return;
  // }
  ```
- **Command**: `npx playwright test -g "scripted rapid submits"`
- **Result**: **FAILED** (as expected)
- **Failing Test**: `scripted rapid submits still produce one confirmation` in [`tests/checkout.spec.js`](../tests/checkout.spec.js)
- **Failing Output**:
  ```
  Error: expect(received).toBe(expected) // Object.is equality

  Expected: "ORD-ABCDEFGH"
  Received: "ORD-JKMNPQRS"

    136 |   expect(result.first).toMatch(ordRegex);
  > 137 |   expect(result.after).toBe(result.first);
        |                        ^
    138 |   expect(result.count).toBe(1);
  ```
- **Evidence File**: [evidence/mutation/M1-guard-removed.txt](../evidence/mutation/M1-guard-removed.txt)

### Mutation M2: Name Trimming Removal
- **Change**: Changed whitespace validation from trimmed length to raw length in `public/app.js`:
  ```javascript
  const hasValidName = rawName.length > 0; // was trimmedName.length > 0
  ```
- **Command**: `npx playwright test -g "missing name"`
- **Result**: **FAILED** (as expected)
- **Failing Test**: `missing name blocks checkout and keeps the cart` in [`tests/checkout.spec.js`](../tests/checkout.spec.js)
- **Failing Output**:
  ```
  Error: Timed out 5000ms waiting for expect(locator).toBeVisible()

  Locator: getByTestId('name-error')
  Expected: visible
  Received: <element(s) not found>

    45 |   await page.getByTestId('place-order').click();
    46 | 
  > 47 |   await expect(page.getByTestId('name-error')).toBeVisible();
       |                                                ^
    48 |   await expect(page.getByTestId('name-error')).toHaveText('Please enter your full name.');
  ```
- **Evidence File**: [evidence/mutation/M2-trim-removed.txt](../evidence/mutation/M2-trim-removed.txt)

### Mutation M3: HTML Escaping Removal
- **Change**: Temporarily made `escapeHtml(str)` in `public/app.js` return `str` unchanged without escaping HTML characters (`&`, `<`, `>`, `"`, `'`).
- **Command**: `npx playwright test -g "shown as text"`
- **Result**: **FAILED** (as expected)
- **Failing Test**: `customer name is shown as text and never rendered as HTML` in [`tests/checkout.spec.js`](../tests/checkout.spec.js)
- **Failing Output**:
  The assertion verifying text rendering failed FIRST on line 265; the subsequent `__xss` poll line was never reached:
  ```
  Error: expect(locator).toHaveText(expected) failed

  Locator:  getByTestId('confirmation-name')
  Expected: "<img src=x onerror=\"window.__xss=1\">Asha"
  Received: "Asha"
  Timeout:  5000ms

  Call log:
    - Expect "toHaveText" getByTestId('confirmation-name') with timeout 5000ms
    - waiting for getByTestId('confirmation-name')
      14 × locator resolved to <span id="confirmation-name" data-testid="confirmation-name">...</span>
         - unexpected value "Asha"

    263 |   await page.getByTestId('place-order').click();
    264 | 
  > 265 |   await expect(page.getByTestId('confirmation-name')).toHaveText('<img src=x onerror="window.__xss=1">Asha');
        |                                                       ^
    266 |   await expect(page.locator('[data-testid="confirmation"] img')).toHaveCount(0);
    267 |   await expect.poll(() => page.evaluate(() => window.__xss)).toBeUndefined();
  ```
- **Evidence File**: [evidence/mutation/M3-escape-removed.txt](../evidence/mutation/M3-escape-removed.txt)

### Mutation M4: Unbroken Name Wrap Removal
- **Change**: Temporarily removed `overflow-wrap: anywhere;` from `.confirmation-card` in `public/styles.css`.
- **Command**: `npx playwright test -g "long unbroken name"`
- **Result**: **FAILED** (as expected)
- **Failing Test**: `a very long unbroken name stays inside the confirmation card` in [`tests/checkout.spec.js`](../tests/checkout.spec.js)
- **Failing Output**:
  ```
  Error: expect(received).toBeLessThanOrEqual(expected)

  Expected: <= 375
  Received:    2300

    276 |   const nameBox = await page.getByTestId('confirmation-name').boundingBox();
    277 |   const cardBox = await page.getByTestId('confirmation').boundingBox();
  > 278 |   expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
        |                                     ^
  ```
- **Evidence File**: [evidence/mutation/M4-wrap-removed.txt](../evidence/mutation/M4-wrap-removed.txt)

### Mutation M5: Real-time Name Validation Untrimmed Check
- **Change**: In the `#name-input` input event listener in `public/app.js`, changed `nameInput.value.trim().length > 0` to `nameInput.value.length > 0`.
- **Command**: `npx playwright test -g "errors clear"`
- **Result**: **FAILED** (as expected)
- **Failing Test**: `errors clear as the customer fixes them` in [`tests/checkout.spec.js`](../tests/checkout.spec.js)
- **Failing Output**:
  ```
  Error: Timed out 5000ms waiting for expect(locator).toBeVisible()

  Locator: getByTestId('name-error')
  Expected: visible
  Received: <element(s) not found>

    300 |   await page.getByTestId('name-input').fill('   ');
  > 301 |   await expect(page.getByTestId('name-error')).toBeVisible();
        |                                                ^
  ```
- **Evidence File**: [evidence/mutation/M5-name-clear-untrimmed.txt](../evidence/mutation/M5-name-clear-untrimmed.txt)

### Mutation M6: Maximum Quantity Check Relaxed
- **Change**: In `parseValidQuantity` in `public/app.js`, changed the upper bound check from `num > 99` to `num > 999`:
  ```javascript
  if (!Number.isInteger(num) || num < 1 || num > 999) return null; // was num > 99
  ```
- **Command**: `npx playwright test -g "invalid quantity"`
- **Result**: **FAILED** (as expected)
- **Failing Test**: `invalid quantity reverts to the last valid value` in [`tests/checkout.spec.js`](../tests/checkout.spec.js)
- **Failing Output**:
  ```
  Error: expect(locator).toHaveText(expected) failed

  Locator:  getByTestId('order-total')
  Expected: "$12.50"
  Received: "$1,250.00"
  Timeout:  5000ms

  Call log:
    - Expect "toHaveText" getByTestId('order-total') with timeout 5000ms
    - waiting for getByTestId('order-total')
      14 × locator resolved to <span id="order-total" aria-live="polite" class="order-total-value" data-testid="order-total">$1,250.00</span>
         - unexpected value "$1,250.00"

    158 |   // Mid-typing "100" must not change the cart
    159 |   await page.getByTestId('qty-notebook').fill('100');
  > 160 |   await expect(page.getByTestId('order-total')).toHaveText('$12.50');
        |                                                 ^
    161 |   await page.getByTestId('qty-notebook').press('Tab');
    162 |   await expect(page.getByTestId('qty-notebook')).toHaveValue('1');
    163 |   await expect(page.getByTestId('order-total')).toHaveText('$12.50');
  ```
- **Evidence File**: [evidence/mutation/M6-max-quantity-removed.txt](../evidence/mutation/M6-max-quantity-removed.txt)

### Restored Suite Verification
Following all mutation checks, `public/app.js` and `public/styles.css` were restored via `git checkout HEAD -- public/app.js public/styles.css`. `git status` confirmed a clean working tree for application files, and the full test suite was executed:
- **Result**: All 15 tests passed cleanly.
- **Evidence File**: [evidence/mutation/restored-suite.txt](../evidence/mutation/restored-suite.txt)

---

## 4. Manual test results

```
MT-1 Empty cart (desktop Chrome 157.0.8103.80, 21-11-2026 ~20:33): typed name "Chinmay Wankhede", cart empty, clicked Place Order. Observed: the cart error "Your cart is empty. Add at least one item before placing your order." was shown with a highlighted border, no confirmation, name preserved, order total $0.00. Evidence: evidence/manual/manual-A-empty-cart.png
MT-2a Rapid double-click, desktop: added Canvas Notebook ($12.50), name "Chinmay Wankhede", clicked Place Order rapidly. Observed: one confirmation, reference ORD-QQY4BDAD, total $12.50; console `document.querySelectorAll('[data-testid="confirmation"]').length` printed 1. Evidence: evidence/manual/manual-B-desktop-double-click.png. Note from the screenshot: the "Start new order" label appeared highlighted.
MT-2b Rapid double-click, phone-sized viewport (DevTools device mode): added Gel Pen Set ($4.99), name "Chinmay Wankhede". Observed: one confirmation, reference ORD-XRCFG74C, total $4.99; the console command printed 1 (run twice, both 1). Evidence: evidence/manual/manual-B-phone-double-click.png
MT-3 DEF-001 manual reproduction on unfixed code (baseline e4a7e45), viewport 1280x500, scrolled to bottom, double-click on Place Order:
  - Reproduced: yes 
  - Attempts: 8
  - What happened: page returned to empty cart, no confirmation; console printed 0
  - Console note: TESTER TO COMPLETE
  - Evidence: evidence/manual/DEF-001-before.png
  - After fix (same steps): confirmation stayed; console printed 1. Evidence: evidence/manual/DEF-001-after.png
```

---

## 5. Defect Report: DEF-001

- **Defect ID**: `DEF-001`
- **Title**: Confirmation lost on rapid double-click in short viewport due to layout collapse
- **Severity**: Medium
- **Status**: Fixed
- **Provenance**: Risk hypothesised during design review (hiding the checkout view shrinks the page, so a late second click could land on Start new order). A text highlight on Start new order in a manual screenshot was consistent with this but is not proof. Confirmed by exploratory probing at 1280x500, then by the regression tests failing before and passing after the fix. Not detected by the three required checks, which do not model a layout shift.
- **Environment**: Desktop Chrome / Chromium, short viewport height (1280x500, scrolled to bottom).
- **Preconditions**:
  - Application loaded on baseline commit `e4a7e45`.
  - Item in cart (Canvas Notebook, $12.50), valid customer name entered.
  - Page scrolled to the bottom so "Place Order" button sits around coordinates `(X: 385, Y: 430)`.

### Steps to Reproduce
1. Resize window to 1280x500.
2. Add "Canvas Notebook" to cart.
3. Enter "Asha Rao" in the Full Name input.
4. Scroll to the bottom of the page (`window.scrollTo(0, document.body.scrollHeight)`).
5. Double-click the "Place Order" button at `(x: 385, y: 430)`.

### Expected vs. Actual
- **Expected**: Order is placed, `#checkout-view` is hidden, confirmation card is rendered with an order reference (`ORD-...`), and the confirmation remains visible on screen.
- **Actual (Unfixed baseline e4a7e45)**: Click 1 places the order and immediately hides `#checkout-view`. The entire shopping view collapses, causing the layout to shift upwards. The newly mounted "Start new order" button lands directly under the cursor coordinates `(385, 430)`. Click 2 lands on "Start new order", immediately triggering `handleNewOrder()`, wiping the state and returning the user to an empty cart with zero confirmation.

### Root-Cause Analysis
Consistent with the regression tests: they fail before and pass after a change that only absorbs a late click on Start new order. The rapid double-click gesture consists of two clicks within ~100–300 ms. Because the DOM updates synchronously on click 1, the layout collapses before click 2 occurs. Click 2 is a genuine mouse event directed at the exact same screen coordinates, where the "Start new order" button has now positioned itself.

### Fix
- **Commit**: `784afa4` (`fix: DEF-001 delay Start new order after confirmation`)
- **Implementation**: In `renderConfirmation()` within `public/app.js`:
  ```javascript
  // Disable button briefly: a late second click from a rapid double-click can land on this button after the layout shifts
  newOrderBtn.disabled = true;
  setTimeout(() => {
    newOrderBtn.disabled = false;
  }, 600);
  ```
  Disabling #new-order absorbs a late trailing click; the button appears disabled for 600 ms. Playwright's click actions auto-wait for enabled buttons, so the tests need no sleeps.

### Verification Evidence
- [evidence/DEF-001/before-tests.txt](../evidence/DEF-001/before-tests.txt) (Failing output on unfixed baseline `e4a7e45`)
- [evidence/DEF-001/before-double-click.png](../evidence/DEF-001/before-double-click.png) (Captured failure screenshot)
- [evidence/DEF-001/before-triple-click.png](../evidence/DEF-001/before-triple-click.png) (Captured failure screenshot)
- [evidence/DEF-001/after-tests.txt](../evidence/DEF-001/after-tests.txt) (Passing output on fixed code `784afa4`)
- [evidence/manual/DEF-001-before.png](../evidence/manual/DEF-001-before.png) (Manual reproduction on baseline)
- [evidence/manual/DEF-001-after.png](../evidence/manual/DEF-001-after.png) (Manual verification after fix)
- [exploratory/evidence/1280x500-y430-double.png](../exploratory/evidence/1280x500-y430-double.png)
- [exploratory/evidence/1280x500-y430-triple.png](../exploratory/evidence/1280x500-y430-triple.png)

### Residual Risk
Assumed, not measured, that a customer takes longer than 600 ms to read the confirmation before clicking Start new order. If a customer attempts to click "Start new order" intentionally within 600 ms of the confirmation card rendering, that click will be ignored because the button is temporarily disabled.

---

## 6. Overall Assessment
No other defects were found by the activities above. One console message ('1 error') is visible in evidence/manual/DEF-001-before.png and is documented in the manual results.
