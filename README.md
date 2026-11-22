# Mini Checkout and Browser Test Suite

## Overview
Mini Checkout is a lightweight, single-page checkout application designed for a small online store. Built strictly with vanilla HTML5, CSS3, and JavaScript, the application runs on a zero-dependency Node.js static server. It provides full cart manipulation with integer-cent monetary precision, immediate field and cart validation with accessible live regions, robust synchronous double-submission prevention, and an automated end-to-end browser test suite powered by Playwright Chromium.

## Requirements
- **Node.js**: `v24.4.1` (Playwright requires Node.js `>=20` as defined in `node_modules/@playwright/test/package.json`)
- **npm**: `11.4.2`
- **Playwright**: `1.65.1`
- **Browser**: Chromium `159.0.8154.6` (installed via Playwright)

## Run the App
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm start
   ```
3. Open your browser to [http://localhost:3000](http://localhost:3000). To override the default port, provide the `PORT` environment variable:
   - **Windows PowerShell**:
     ```powershell
     $env:PORT=3001; npm start
     ```
   - **macOS / Linux**:
     ```bash
     PORT=3001 npm start
     ```

## Run the Browser Tests
1. Install browser binaries (if not already installed):
   ```bash
   npx playwright install chromium
   ```
2. Run the automated test suite (15 tests):
   ```bash
   npm test
   ```
3. View the HTML test report:
   ```bash
   npm run report
   ```
4. Run tests interactively in headed mode:
   ```bash
   npm run test:headed
   ```
5. Run an individual test by exact title or pattern:
   ```bash
   npx playwright test -g "successful checkout shows a single order confirmation with a reference"
   ```

*Note on cross-platform execution*: Windows PowerShell, macOS, and Linux use identical `npm` and `npx` commands. Playwright tests automatically spin up their own web server instance on port `3100` (`reuseExistingServer: !process.env.CI`). If a stale process remains bound to port `3100`, terminate it if test results look anomalous.

## Project Structure
```
mini-checkout/
├── package.json                          # Scripts and @playwright/test devDependency
├── package-lock.json
├── server.js                             # Zero-dependency Node.js static file server
├── playwright.config.js                  # Playwright Chromium test configuration
├── playwright.exploratory.config.js      # Configuration for the exploratory probe
├── scripts/
│   └── collect-evidence.js               # Machine-generates all evidence files and SUMMARY.md
├── public/
│   ├── index.html                        # Semantic HTML with accessibility handles and testids
│   ├── styles.css                        # CSS layout, focus outlines, and responsive styles
│   └── app.js                           # State, integer cents math, validation, and confirmation
├── tests/
│   └── checkout.spec.js                  # 15 automated Playwright Chromium end-to-end tests
├── exploratory/
│   ├── double-click-probe.spec.js        # Viewport and layout-shift exploratory probe
│   └── evidence/                         # Baseline probe failure screenshots
│       ├── 1280x500-y430-double.png
│       └── 1280x500-y430-triple.png
├── evidence/
│   ├── SUMMARY.md                        # Machine-generated execution summary table
│   ├── automated/                        # Verbatim outputs from automated test suites
│   ├── DEF-001/                          # Defect DEF-001 before/after test logs and screenshots
│   ├── manual/                           # Manual exploratory test run evidence screenshots
│   └── mutation/                         # 7 mutation testing runs and restored suite verification
└── docs/
    ├── TEST_PLAN.md                      # Risk register, coverage matrix, and test specifications
    └── TEST_RESULTS.md                   # Automated, manual, mutation, and defect write-ups
```

## Reproducing the Evidence

All automated test evidence, stability benchmarks, exploratory probe captures, DEF-001 before/after regression logs, and 7 mutation checks are machine-generated and fully reproducible via:
```bash
npm run evidence
```

What this script does:
- Verifies that the git working tree for `public/` and `tests/` is clean.
- Captures runtime environment details (`node`, `npm`, Playwright, OS, and Chromium versions) into `evidence/automated/environment.txt`.
- Executes the automated test suite (`npx playwright test`), stability run (`--repeat-each=5`), single-worker isolation (`--workers=1`), and exploratory layout shift probe (`playwright.exploratory.config.js`).
- Executes DEF-001 regression validation by temporarily writing the baseline `app.js` (`git show e4a7e45:public/app.js`), verifying failure (Red), restoring clean code, and verifying pass (Green).
- Performs 7 table-driven mutation checks (M1 through M7), ensuring each mutation is cleanly killed by targeted tests and verified restored byte-for-byte.
- Re-runs the full test suite and verifies `git diff --exit-code -- public` is clean.
- Automatically compiles all exit codes, test counts, probe totals, and mutation failure signatures into [`evidence/SUMMARY.md`](evidence/SUMMARY.md).

Execution takes a few minutes because it runs all test suites and mutations. To preview the execution plan and verify that all mutation targets match uniquely without running tests or modifying files, run:
```bash
node scripts/collect-evidence.js --dry-run
```

## Automated Test Suite

### The three required checks (from the brief)
1. Successful checkout produces a confirmation -> [`successful checkout shows a single order confirmation with a reference`](tests/checkout.spec.js)
2. A missing field blocks checkout -> [`missing name blocks checkout and keeps the cart`](tests/checkout.spec.js)
3. A quantity change updates the exact total -> [`changing quantities updates line totals and the exact order total`](tests/checkout.spec.js)

### Additional automated tests (12)
- [`empty cart blocks checkout`](tests/checkout.spec.js)
- [`double submit produces exactly one confirmation`](tests/checkout.spec.js)
- [`scripted rapid submits still produce one confirmation`](tests/checkout.spec.js)
- [`invalid quantity reverts to the last valid value`](tests/checkout.spec.js)
- [`remove and start-new-order reset`](tests/checkout.spec.js)
- [`empty cart and blank name show both messages and focus the first problem`](tests/checkout.spec.js)
- [`rapid double-click on Place Order in a short window keeps the confirmation`](tests/checkout.spec.js)
- [`rapid triple-click on Place Order in a short window keeps the confirmation`](tests/checkout.spec.js)
- [`customer name is shown as text and never rendered as HTML`](tests/checkout.spec.js)
- [`a very long unbroken name stays inside the confirmation card`](tests/checkout.spec.js)
- [`pressing Enter in the name field places the order once`](tests/checkout.spec.js)
- [`errors clear as the customer fixes them`](tests/checkout.spec.js)

## Manual Tests
For human-driven testing scenarios (empty cart error appearance, desktop double-click, and phone viewport gestures), detailed instructions and results are documented in [docs/TEST_PLAN.md](docs/TEST_PLAN.md#5-manual-test-cases) and [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md#4-manual-test-results).

## Exploratory Probe
To investigate layout shift and click-through anomalies under extreme conditions, an exploratory test probe is provided:
```bash
npm run probe
```
The probe sweeps 8 distinct viewport resolutions across 10 target vertical coordinates with rapid double and triple click sequences using browser-level input events sent through the Chrome DevTools Protocol (`page.mouse`). The probe is a diagnostic measurement tool rather than a release gate; in short windows, requested Y values naturally clamp to the scroll boundary. Following the DEF-001 fix, the probe executes 152 attempts across 22 distinct layout scenarios with zero lost confirmations.

## Design Decisions
- **Integer Cents Precision**: All financial calculations are stored and evaluated in whole integer cents (e.g. Notebook = 1250 cents, Pens = 499 cents). Dollar formatting occurs strictly at the display boundary via `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`, avoiding floating-point rounding errors.
- **Persistent Place Order Button**: The "Place Order" button remains enabled when the cart or name is invalid, ensuring users receive immediate actionable validation feedback and accessibility alerts upon clicking.
- **Synchronous Double-Submit Guard**: `orderPlaced` and `isSubmitting` guard flags are evaluated and updated synchronously at the very top of the submit handler, discarding secondary submission events before asynchronous tasks occur.
- **Stateless Clean State**: No `localStorage`, `sessionStorage`, or cookies are utilized. Refreshing the browser guarantees a pristine, initial state.

## Known Limitations
- **Chromium Only**: Test automation targets Playwright Chromium exclusively, as specified in the project scope. Cross-browser testing across Firefox or WebKit has not been executed.
- **Screen Reader Audit**: While semantic HTML elements, ARIA alert roles, `aria-invalid`, `aria-describedby`, and focus management are implemented, no formal physical screen-reader audit (e.g. with NVDA or VoiceOver) has been performed.
- **DEF-001 Fix Debounce**: The fix for layout-shift click-through disables the "Start new order" button for 600 ms upon mounting. An intentional click by a user within that initial 600 ms window is ignored.
- **Client-Side Order Generation**: There is no persistence backend or payment gateway. Order reference codes (`ORD-...`) are generated locally via `crypto.getRandomValues()` and are not saved to a remote database.

## Reproducing DEF-001
Defect DEF-001 (confirmation lost due to layout collapse shifting "Start new order" under the cursor during a rapid double-click in a short window) can be verified and reproduced with git:
1. Restore the unfixed baseline application script:
   ```bash
   git checkout e4a7e45 -- public/app.js
   ```
2. Run the regression test suite (it will fail with received confirmation count 0):
   ```bash
   npx playwright test -g "short window"
   ```
3. Restore the fixed code:
   ```bash
   git checkout HEAD -- public/app.js
   ```
4. Re-run the regression tests (both tests pass):
   ```bash
   npx playwright test -g "short window"
   ```
