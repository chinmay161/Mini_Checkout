const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Double-click layout-shift probe', () => {
  test('sweep viewports, target Y coordinates, and click modes', async ({ page }) => {
    test.setTimeout(300000);

    const evidenceDir = path.join(__dirname, 'evidence');
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }

    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1280, height: 720 },
      { width: 1280, height: 500 },
      { width: 800, height: 600 },
      { width: 390, height: 844 },
      { width: 375, height: 667 },
      { width: 360, height: 640 },
    ];

    const targetYs = [60, 120, 180, 240, 300, 360, 420, 480, 540, 600];
    const modes = ['double', 'triple'];

    const results = [];
    const totals = {
      ONE_CONFIRMATION: 0,
      CONFIRMATION_LOST: 0,
      MULTIPLE: 0,
      OTHER: 0,
    };

    let headingFocusedCount = 0;
    let headingCheckedCount = 0;

    for (const vp of viewports) {
      const validYs = targetYs.filter((y) => y < vp.height - 30);

      for (const targetY of validYs) {
        for (const mode of modes) {
          // 1. Set viewport, navigate, add notebook, fill name
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto('/');

          await page.getByTestId('add-notebook').click();
          await page.getByTestId('name-input').fill('Asha Rao');

          // 2. Scroll so Place Order button vertical centre sits as close as possible to target Y
          const btn = page.getByTestId('place-order');
          let box = await btn.boundingBox();

          if (box) {
            const currentScrollY = await page.evaluate(() => window.scrollY);
            const currentCenterY = box.y + box.height / 2;
            const delta = currentCenterY - targetY;
            const targetScrollY = Math.max(0, currentScrollY + delta);

            await page.evaluate((sy) => window.scrollTo(0, sy), targetScrollY);
            box = await btn.boundingBox();
          }

          if (!box) {
            results.push({
              viewport: `${vp.width}x${vp.height}`,
              requestedY: targetY,
              actualX: 'N/A',
              actualY: 'N/A',
              mode,
              classification: 'OTHER',
            });
            totals.OTHER++;
            continue;
          }

          const actualX = Math.round(box.x + box.width / 2);
          const actualY = Math.round(box.y + box.height / 2);

          // 3. Real mouse input at calculated centre
          if (mode === 'double') {
            await page.mouse.dblclick(actualX, actualY);
          } else if (mode === 'triple') {
            await page.mouse.click(actualX, actualY);
            await page.mouse.click(actualX, actualY);
            await page.mouse.click(actualX, actualY);
          }

          // 4. Immediately read outcome WITHOUT waiting
          const outcome = await page.evaluate(() => {
            const confirmations = document.querySelectorAll('[data-testid="confirmation"]');
            const confirmationCount = confirmations.length;
            const newOrderEl = document.querySelector('[data-testid="new-order"]');
            const isNewOrderVisible = newOrderEl ? (!newOrderEl.hidden && newOrderEl.offsetParent !== null) : false;
            const cartEmptyEl = document.querySelector('[data-testid="cart-empty-message"]');
            const isCartEmptyVisible = cartEmptyEl ? (!cartEmptyEl.hidden && cartEmptyEl.offsetParent !== null) : false;
            const orderTotalEl = document.querySelector('[data-testid="order-total"]');
            const orderTotalText = orderTotalEl?.textContent ?? '';
            const heading = document.querySelector('#confirmation h2');
            const isHeadingFocused = document.activeElement === heading;

            return {
              confirmationCount,
              isNewOrderVisible,
              isCartEmptyVisible,
              orderTotalText,
              isHeadingFocused,
            };
          });

          // 5. Classify
          let classification = 'OTHER';
          if (outcome.confirmationCount === 1) {
            classification = 'ONE_CONFIRMATION';
            headingCheckedCount++;
            if (outcome.isHeadingFocused) {
              headingFocusedCount++;
            }
          } else if (outcome.confirmationCount === 0) {
            classification = 'CONFIRMATION_LOST';
          } else if (outcome.confirmationCount > 1) {
            classification = 'MULTIPLE';
          }

          totals[classification]++;

          // Screenshot for non-OK results
          if (classification !== 'ONE_CONFIRMATION') {
            const ssPath = path.join(
              evidenceDir,
              `${vp.width}x${vp.height}-y${actualY}-${mode}.png`
            );
            await page.screenshot({ path: ssPath });
          }

          results.push({
            viewport: `${vp.width}x${vp.height}`,
            requestedY: targetY,
            actualX,
            actualY,
            mode,
            classification,
          });
        }
      }
    }

    // Print compact table
    console.log('\n=== DOUBLE-CLICK LAYOUT-SHIFT PROBE RESULTS ===');
    console.log('| Viewport   | Req Y | Actual (X, Y) | Mode   | Classification   |');
    console.log('|------------|-------|---------------|--------|------------------|');
    for (const r of results) {
      const vpStr = r.viewport.padEnd(10);
      const reqYStr = String(r.requestedY).padStart(5);
      const actualStr = `(${r.actualX}, ${r.actualY})`.padEnd(13);
      const modeStr = r.mode.padEnd(6);
      const classStr = r.classification.padEnd(16);
      console.log(`| ${vpStr} | ${reqYStr} | ${actualStr} | ${modeStr} | ${classStr} |`);
    }

    console.log('\n=== TOTALS PER CLASSIFICATION ===');
    console.log(`ONE_CONFIRMATION : ${totals.ONE_CONFIRMATION}`);
    console.log(`CONFIRMATION_LOST: ${totals.CONFIRMATION_LOST}`);
    console.log(`MULTIPLE         : ${totals.MULTIPLE}`);
    console.log(`OTHER            : ${totals.OTHER}`);
    console.log(`TOTAL ATTEMPTS   : ${results.length}`);
    console.log(`CONFIRMATION HEADING FOCUSED: ${headingFocusedCount} / ${headingCheckedCount}`);
  });
});
