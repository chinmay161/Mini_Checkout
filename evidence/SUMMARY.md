# Evidence Execution Summary

**Generated**: 2026-11-22T03:29:30.651Z
**Environment**: Windows_NT 10.0.26300 (x64) | Node: v24.4.1 | npm: 11.4.2
**Playwright**: Version 1.65.1 | Chromium: 159.0.8154.6

## 1. Automated Test Execution Commands

| Test Run / Target | Command | Exit Code | Result | Evidence File |
| :--- | :--- | :--- | :--- | :--- |
| **Full Test Suite** | `npx playwright test` | 0 | 15 passed (6.7s) | [evidence/automated/npm-test.txt](../evidence/automated/npm-test.txt) |
| **Repeat Each 5** | `npx playwright test --repeat-each=5` | 0 | 75 passed (26.8s) | [evidence/automated/repeat-each-5.txt](../evidence/automated/repeat-each-5.txt) |
| **Workers 1** | `npx playwright test --workers=1` | 0 | 15 passed (8.4s) | [evidence/automated/workers-1.txt](../evidence/automated/workers-1.txt) |
| **Exploratory Probe** | `npx playwright test -c playwright.exploratory.config.js` | 0 | 1 passed (22.7s) | [evidence/automated/probe.txt](../evidence/automated/probe.txt) |
| **DEF-001 Baseline (Red)** | `npx playwright test -g "short window"` | 1 | 2 failed | [evidence/DEF-001/before-tests.txt](../evidence/DEF-001/before-tests.txt) |
| **DEF-001 Fixed (Green)** | `npx playwright test -g "short window"` | 0 | 2 passed (2.4s) | [evidence/DEF-001/after-tests.txt](../evidence/DEF-001/after-tests.txt) |

## 2. Exploratory Layout Shift Probe Totals

Parsed from [evidence/automated/probe.txt](../evidence/automated/probe.txt):

| Metric | Value |
| :--- | :--- |
| **ONE_CONFIRMATION** | 152 |
| **CONFIRMATION_LOST** | 0 |
| **MULTIPLE** | 0 |
| **OTHER** | 0 |
| **Total Attempts** | 152 |
| **Distinct Scenarios Tested** | 22 |

## 3. Mutation Testing Results (M1–M7)

| ID | File | Description | Grep Filter | Status | First Error Line | Evidence File |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M1** | `public/app.js` | Remove early double-submit guard in submit handler | `scripted rapid submits` | **KILLED** | `Error: expect(received).toBe(expected) // Object.is equality` | [evidence/mutation/M1-guard-removed.txt](../evidence/mutation/M1-guard-removed.txt) |
| **M2** | `public/app.js` | Allow raw untrimmed name length to pass validation | `missing name` | **KILLED** | `Error: expect(locator).toBeVisible() failed` | [evidence/mutation/M2-trim-removed.txt](../evidence/mutation/M2-trim-removed.txt) |
| **M3** | `public/app.js` | escapeHtml returns raw unescaped string | `shown as text` | **KILLED** | `Error: expect(locator).toHaveText(expected) failed` | [evidence/mutation/M3-escape-removed.txt](../evidence/mutation/M3-escape-removed.txt) |
| **M4** | `public/styles.css` | Delete overflow-wrap: anywhere rule from confirmation card | `long unbroken name` | **KILLED** | `Error: expect(received).toBeLessThanOrEqual(expected)` | [evidence/mutation/M4-wrap-removed.txt](../evidence/mutation/M4-wrap-removed.txt) |
| **M5** | `public/app.js` | Clear name error on raw untrimmed input length | `errors clear` | **KILLED** | `Error: expect(locator).toBeVisible() failed` | [evidence/mutation/M5-name-clear-untrimmed.txt](../evidence/mutation/M5-name-clear-untrimmed.txt) |
| **M6** | `public/app.js` | Relax parseValidQuantity upper bound from 99 to 999 | `invalid quantity` | **KILLED** | `Error: expect(locator).toHaveText(expected) failed` | [evidence/mutation/M6-max-quantity-removed.txt](../evidence/mutation/M6-max-quantity-removed.txt) |
| **M7** | `public/app.js` | Remove 600 ms disabled delay on Start new order button | `short window` | **KILLED** | `Error: expect(locator).toHaveCount(expected) failed` | [evidence/mutation/M7-new-order-delay-removed.txt](../evidence/mutation/M7-new-order-delay-removed.txt) |

## 4. Final Verification

- **Restored Test Suite**: `15 passed (5.4s)` (Exit Code: 0)
- **Git Tree Cleanliness**: `git diff --exit-code -- public` -> **CLEAN** (0 diff)
- **Overall Status**: **ALL CHECKS PASSED**
