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

The automated test suite was executed across multiple worker configurations and repeat runs. Real test counts and durations copied from the evidence files:

| Test Run Type | Command | Total Tests | Passed | Failed | Flakes | Duration | Evidence File |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Full Test Suite** | `npm test` | 11 | 11 | 0 | 0 | 4.2s | [evidence/automated/npm-test.txt](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/automated/npm-test.txt) |
| **Stability Run** | `npx playwright test --repeat-each=5` | 55 | 55 | 0 | 0 | 10.4s | [evidence/automated/repeat-each-5.txt](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/automated/repeat-each-5.txt) |
| **Isolation Run** | `npx playwright test --workers=1` | 11 | 11 | 0 | 0 | 7.0s | [evidence/automated/workers-1.txt](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/automated/workers-1.txt) |

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
- **Duration**: 22.8s
- **Evidence File**: [evidence/automated/probe.txt](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/automated/probe.txt)

> **Plain-language note on probe coverage**: The 152 probe rows overstate independent coverage because requested Y coordinates frequently clamp to the page scroll boundary (`document.body.scrollHeight`). On short pages or small viewports, multiple requested Y values target the exact same bottom position (actual coordinates). The probe is a diagnostic measurement tool rather than a release gate, and these numbers accurately reflect the live hit-testing behavior of the layout after the DEF-001 fix.

---

## 3. Mutation Checks

Two mutations were applied to `public/app.js` to ensure the test suite catches critical regressions.

### Mutation M1: Submit Guard Removal
- **Change**: Commented out the early double-submit guard in `public/app.js`:
  ```javascript
  // if (orderPlaced || isSubmitting) {
  //   return;
  // }
  ```
- **Command**: `npx playwright test -g "scripted rapid submits"`
- **Result**: **FAILED** (as expected)
- **Failing Test**: `scripted rapid submits still produce one confirmation` at [tests/checkout.spec.js:111:1](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/tests/checkout.spec.js#L111)
- **Failing Assertion**:
  ```
  expect(result.after).toBe(result.first)
  ```
  - **Expected**: First generated order reference (e.g. `"ORD-..."`)
  - **Received**: A newly regenerated order reference from the second submission attempt
- **Evidence File**: [evidence/mutation/M1-guard-removed.txt](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/mutation/M1-guard-removed.txt)

### Mutation M2: Name Trimming Removal
- **Change**: Changed whitespace validation from trimmed length to raw length in `public/app.js`:
  ```javascript
  const hasValidName = rawName.length > 0; // was trimmedName.length > 0
  ```
- **Command**: `npx playwright test -g "missing name"`
- **Result**: **FAILED** (as expected)
- **Failing Test**: `missing name blocks checkout and keeps the cart` at [tests/checkout.spec.js:36:1](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/tests/checkout.spec.js#L36)
- **Failing Assertion**:
  ```
  await expect(page.getByTestId('name-error')).toBeVisible()
  ```
  - **Expected**: Visible `#name-error` element
  - **Received**: Element not visible (timed out after 5000ms because raw string `"   "` with length 3 was erroneously accepted as valid, placing the order instead of blocking)
- **Evidence File**: [evidence/mutation/M2-trim-removed.txt](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/mutation/M2-trim-removed.txt)

### Restored Suite Verification
Following mutation tests, `public/app.js` was restored via `git checkout HEAD -- public/app.js`. `git status` confirmed a clean working tree for application files, and the full test suite was executed:
- **Result**: All 11 tests passed in 3.4s (6 workers).
- **Evidence File**: [evidence/mutation/restored-suite.txt](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/mutation/restored-suite.txt)

---

## 4. TESTER-SUPPLIED MANUAL RESULTS (Transcribed Verbatim)

```
MT-1 Empty cart (desktop Chrome 157.0.8103.80, 21-11-2026 ~20:33): typed name "Chinmay Wankhede", cart empty, clicked Place Order. Observed: the cart error "Your cart is empty. Add at least one item before placing your order." was shown with a highlighted border, no confirmation, name preserved, order total $0.00. Evidence: evidence/manual/manual-A-empty-cart.png
MT-2a Rapid double-click, desktop: added Canvas Notebook ($12.50), name "Chinmay Wankhede", clicked Place Order rapidly. Observed: one confirmation, reference ORD-QQY4BDAD, total $12.50; console `document.querySelectorAll('[data-testid="confirmation"]').length` printed 1. Evidence: evidence/manual/manual-B-desktop-double-click.png. Note from the screenshot: the "Start new order" label appeared highlighted.
MT-2b Rapid double-click, phone-sized viewport (DevTools device mode): added Gel Pen Set ($4.99), name "Chinmay Wankhede". Observed: one confirmation, reference ORD-XRCFG74C, total $4.99; the console command printed 1 (run twice, both 1). Evidence: evidence/manual/manual-B-phone-double-click.png
MT-3 DEF-001 manual reproduction on unfixed code (baseline e4a7e45), viewport 1280x500, scrolled to bottom, double-click on Place Order:
  - Reproduced: yes 
  - Attempts: 8
  - What happened:  page returned to empty cart, no confirmation; console printed 0
  - Evidence: evidence/manual/DEF-001-before.png
  - After fix (same steps): onfirmation stayed; console printed - evidence: evidence/manual/DEF-001-after.png 
```

---

## 5. Defect Report: DEF-001

- **Defect ID**: `DEF-001`
- **Title**: Confirmation lost on rapid double-click in short viewport due to layout collapse
- **Severity**: Medium
- **Status**: Fixed
- **Provenance**: Discovered during exploratory probe sweep following reviewer inspection of a manual test screenshot showing the "Start new order" button in an active/highlighted focus state after order placement. Not detected by the initial three required functional checks.
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
  Disabling `#new-order` for 600 ms cleanly absorbs trailing clicks without visual flicker or jarring layout changes. Playwright's click actions auto-wait for buttons to become enabled, so standard automated tests require no artificial sleeps.

### Verification Evidence
- [evidence/DEF-001/before-tests.txt](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/DEF-001/before-tests.txt) (Failing output on unfixed baseline `e4a7e45`)
- [evidence/DEF-001/before-double-click.png](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/DEF-001/before-double-click.png) (Captured failure screenshot)
- [evidence/DEF-001/before-triple-click.png](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/DEF-001/before-triple-click.png) (Captured failure screenshot)
- [evidence/DEF-001/after-tests.txt](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/DEF-001/after-tests.txt) (Passing output on fixed code `784afa4`)
- [evidence/manual/DEF-001-before.png](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/manual/DEF-001-before.png) (Manual reproduction on baseline)
- [evidence/manual/DEF-001-after.png](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/evidence/manual/DEF-001-after.png) (Manual verification after fix)
- [exploratory/evidence/1280x500-y430-double.png](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/exploratory/evidence/1280x500-y430-double.png)
- [exploratory/evidence/1280x500-y430-triple.png](file:///c:/Users/Chinmay/Desktop/Vs%20Code/Mini_Checkout/exploratory/evidence/1280x500-y430-triple.png)

### Residual Risk
If a customer attempts to click "Start new order" intentionally within 600 ms of the confirmation card rendering, that click will be ignored because the button is temporarily disabled. Normal human reaction time to read the confirmation and click "Start new order" is well over 600 ms.

---

## 6. Overall Assessment
No other defects were found during automated suite runs (11/11 tests passing, 55/55 stability runs, 11/11 isolation checks), exploratory probe execution (152/152 tests passing), or manual test executions.
