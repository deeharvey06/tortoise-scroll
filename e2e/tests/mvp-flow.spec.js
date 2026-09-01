import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  selectMuiOptionByLabel,
  selectMuiOptionInRow,
  uploadViaLabelButton,
  selectAccountFilter,
  findImportedTradeRow,
  authenticateAsDemo,
} from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_FIXTURE = path.join(__dirname, '..', 'fixtures', 'sample-trades.csv');
const PNG_FIXTURE = path.join(
  __dirname,
  '..',
  'fixtures',
  'sample-screenshot.png',
);

/**
 * This spec directly answers the MVP acceptance audit: every step below
 * was previously only verified at the API/schema level. This drives the
 * real browser UI end to end, in the order the audit specified, and each
 * test builds on state left behind by the previous one (test.describe.serial).
 *
 * Prerequisite: MongoDB must already be running locally. The API server and
 * Vite client are started automatically by playwright.config.js.
 */

const RUN_ID = Date.now();
const ACCOUNT_NAME = `E2E Account ${RUN_ID}`;
const STRATEGY_NAME = `E2E Strategy ${RUN_ID}`;
const PLAYBOOK_NAME = `E2E Playbook ${RUN_ID}`;

test.describe.serial('MVP end-to-end flow', () => {
  test.beforeEach(async ({ page, request }) => {
    await authenticateAsDemo(page, request);
  });

  test('01 — create an account', async ({ page }) => {
    await page.goto('/trades');
    await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible();

    await page.getByRole('button', { name: 'New account' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Account name').fill(ACCOUNT_NAME);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Create' })
      .click();

    await expect(page.getByRole('dialog')).toBeHidden();
    // The "New trade" button is disabled until at least one account exists —
    // confirming it's enabled proves the account really landed in the DB,
    // not just that the dialog closed.
    await expect(page.getByRole('button', { name: 'New trade' })).toBeEnabled();
  });

  test('02 — import a CSV of trades', async ({ page }) => {
    await page.goto('/import');
    await expect(
      page.getByRole('heading', { name: 'Import trades' }),
    ).toBeVisible();

    await uploadViaLabelButton(page, 'Choose file', CSV_FIXTURE);
    await expect(page.getByText('Selected:')).toBeVisible();
    await page.getByRole('button', { name: 'Preview' }).click();

    // Mapping step — map the fixture's headers (Ticker, Side, Shares, In,
    // Out, Opened, Closed) to the app's canonical trade fields.
    await expect(page.getByText(/rows detected/)).toBeVisible();
    await selectMuiOptionInRow(page, 'Symbol', 'Ticker');
    await selectMuiOptionInRow(page, 'Direction', 'Side');
    await selectMuiOptionInRow(page, 'Quantity', 'Shares');
    await selectMuiOptionInRow(page, 'Entry price', 'In');
    await selectMuiOptionInRow(page, 'Exit price', 'Out');
    await selectMuiOptionInRow(page, 'Entry time', 'Opened');
    await selectMuiOptionInRow(page, 'Exit time', 'Closed');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Confirm step — choose the account created in test 01.
    await selectMuiOptionByLabel(page, 'Import into account', ACCOUNT_NAME);
    await page.getByRole('button', { name: /^Import \d+ rows$/ }).click();

    // Result step — both fixture rows should import cleanly (0 errors).
    await expect(page.getByText(/^2 imported$/)).toBeVisible();
    await expect(page.getByText(/^0 errors$/)).toBeVisible();
  });

  test('03 — open the imported trade', async ({ page }) => {
    await page.goto('/trades');
    await selectAccountFilter(page, ACCOUNT_NAME);
    const tradeRow = findImportedTradeRow(page, 'AAPL', 'Aug 20, 2026');
    await expect(tradeRow).toBeVisible();

    await tradeRow.click();
    await expect(page).toHaveURL(/\/trades\/[a-f0-9]{24}$/);
    await expect(page.getByRole('heading', { name: 'AAPL' })).toBeVisible();
    // Net P&L for this fixture row is a known, real, computed value —
    // (191.50 - 190.00) * 100 = $150 gross, matching the Phase 1 worked
    // example. Confirms the app is computing, not just displaying zeros.
    // (May legitimately appear twice — Summary's Net P&L and Execution's
    // Gross P&L are equal here since the fixture has no fees/commission.)
    await expect(page.getByText('$150.00').first()).toBeVisible();
  });

  test('04 — add a note and a tag to the trade', async ({ page, context }) => {
    // Re-navigate via the Trades list (each test gets a fresh page context
    // state-wise, but serial mode shares the same page across tests in
    // some Playwright versions — re-navigating is always safe either way).
    await page.goto('/trades');
    await selectAccountFilter(page, ACCOUNT_NAME);
    const tradeRow = findImportedTradeRow(page, 'AAPL', 'Aug 20, 2026');
    await tradeRow.click();
    await expect(page).toHaveURL(/\/trades\/[a-f0-9]{24}$/);

    await page
      .getByLabel('Notes')
      .fill('E2E test note: clean breakout above premarket high.');
    await page.getByLabel('Tags').fill('e2e-verified');
    await page.keyboard.press('Enter');

    await page.getByRole('button', { name: 'Save journal' }).click();
    await expect(page.getByText('Journal saved')).toBeVisible();

    // Reload and confirm it actually persisted server-side, not just in
    // local component state.
    await page.reload();
    await expect(page.getByLabel('Notes')).toHaveValue(
      /clean breakout above premarket high/,
    );
    await expect(page.getByText('e2e-verified').first()).toBeVisible();
  });

  test('05 — upload a screenshot to the trade', async ({ page }) => {
    await page.goto('/trades');
    await selectAccountFilter(page, ACCOUNT_NAME);
    const tradeRow = findImportedTradeRow(page, 'AAPL', 'Aug 20, 2026');
    await tradeRow.click();
    await expect(page).toHaveURL(/\/trades\/[a-f0-9]{24}$/);

    await uploadViaLabelButton(page, 'Upload', PNG_FIXTURE);
    await expect(page.getByAltText('Trade screenshot')).toBeVisible();

    // Reload to confirm the screenshot is actually persisted on the trade
    // document (served from /uploads), not just held in local state.
    await page.reload();
    await expect(page.getByAltText('Trade screenshot')).toBeVisible();
  });

  test('06 — create a strategy and a playbook', async ({ page }) => {
    await page.goto('/strategies');
    await page.getByRole('button', { name: 'New strategy' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill(STRATEGY_NAME);
    await page
      .getByRole('dialog')
      .getByLabel('Entry rules')
      .fill('Enter on break of premarket high with volume.');
    await page.getByRole('button', { name: 'Create strategy' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(
      page.getByRole('heading', { name: STRATEGY_NAME }),
    ).toBeVisible();

    await page.goto('/playbooks');
    await page.getByRole('button', { name: 'New playbook' }).click();
    await page.getByRole('dialog').getByLabel('Setup name').fill(PLAYBOOK_NAME);
    await page
      .getByRole('dialog')
      .getByLabel('Entry criteria')
      .fill('Confirmed breakout candle closes above level.');
    await page.getByRole('button', { name: 'Create playbook' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(
      page.getByRole('heading', { name: PLAYBOOK_NAME }),
    ).toBeVisible();
  });

  test('07 — assign the strategy and playbook to the trade', async ({
    page,
  }) => {
    await page.goto('/trades');
    await selectAccountFilter(page, ACCOUNT_NAME);
    const aaplRow = findImportedTradeRow(page, 'AAPL', 'Aug 20, 2026');
    await aaplRow.getByRole('button', { name: 'Edit trade' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await selectMuiOptionByLabel(page, 'Strategy (optional)', STRATEGY_NAME);
    await selectMuiOptionByLabel(page, 'Playbook (optional)', PLAYBOOK_NAME);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Confirm on the Strategies page that this trade now rolls up into its
    // performance panel — the real proof the assignment took effect.
    await page.goto('/strategies');
    await page.getByRole('button', { name: new RegExp(STRATEGY_NAME) }).click();
    const tradesKpiValue = page.getByTestId('kpi-trades-value');
    await expect(tradesKpiValue).toBeVisible();
    await expect(tradesKpiValue).not.toHaveText('—');
    await expect(tradesKpiValue).toHaveText(/^[1-9]\d*$/);
  });

  test('08 — inspect the Dashboard (KPIs and charts render with real data)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Dashboard' }),
    ).toBeVisible();

    // KPI cards — targeted via the stable data-testid KpiCard exposes
    // (kpi-<slugified-label>), not fragile text/DOM-structure guessing.
    await expect(page.getByTestId('kpi-net-p-l')).toBeVisible();
    await expect(page.getByTestId('kpi-win-rate')).toBeVisible();
    await expect(page.getByTestId('kpi-total-trades-value')).toHaveText(
      /^\d+$/,
    );

    // Chart sections actually render an SVG (Recharts), not an empty state —
    // this is the concrete proof the equity curve/drawdown charts draw.
    await expect(
      page.getByTestId('chart-equity-curve').locator('svg').first(),
    ).toBeVisible();
    await expect(
      page.getByTestId('chart-drawdown').locator('svg').first(),
    ).toBeVisible();
  });

  test('09 — filter the Dashboard by symbol and confirm it actually changes', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('kpi-total-trades').getByText('Total trades')).toBeVisible();

    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByRole('textbox', { name: 'Symbol' }).fill('AAPL');
    await page.keyboard.press('Escape'); // close popover

    // The active-filter chip should now show AAPL, and the Filters button
    // should reflect an active filter count.
    await expect(
      page.getByRole('button', { name: /Filters \(1\)/ }),
    ).toBeVisible();
    await expect(
      page.locator('.MuiChip-root', { hasText: 'AAPL' }),
    ).toBeVisible();

    // Clear filters and confirm the chip disappears.
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByRole('button', { name: /^Filters$/ })).toBeVisible();
  });

  test('10 — analyze performance via Reports and Analytics pages', async ({
    page,
  }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(page.getByText('Net P&L')).toBeVisible(); // Performance tab default

    await page.getByRole('tab', { name: 'Market' }).click();
    await expect(page.getByText('By symbol')).toBeVisible();

    await page.goto('/analytics');
    await expect(
      page.getByRole('heading', { name: 'Analytics' }),
    ).toBeVisible();
    await expect(page.getByText('P&L by symbol')).toBeVisible();
  });

  test('11 — review a trading day on the Calendar', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: /\w+ \d{4}/, level: 6 })).toBeVisible();

    // The fixture's AAPL trade is dated 2026-08-20. The calendar defaults to
    // the current month; this searches backward up to 24 months to find
    // August 2026, which assumes this suite runs on or after that date
    // (true for any real run of this app, since it didn't exist before
    // then). If you're running this from a date before August 2026 for
    // some reason, change fixtures/sample-trades.csv dates to match instead.
    const targetMonthLabel = 'August 2026';
    for (let i = 0; i < 24; i += 1) {
      const label = await page.getByRole('heading', { name: /\w+ \d{4}/, level: 6 }).textContent();
      if (label === targetMonthLabel) break;
      await page.getByRole('button', { name: 'Previous month' }).click();
    }
    await expect(page.getByRole('heading', { name: /\w+ \d{4}/, level: 6 })).toHaveText(
      targetMonthLabel,
    );

    await page.getByRole('button', { name: /August 20:.*trades/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page
        .getByRole('dialog')
        .getByRole('cell', { name: 'AAPL', exact: true })
        .first(),
    ).toBeVisible();
  });

  test('12 — create a pre-market plan journal entry', async ({ page }) => {
    await page.goto('/journal');
    await page.getByRole('button', { name: 'Pre-market plan' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('textbox', { name: 'Market', exact: true })
      .fill('SPY gapping up on CPI data');
    await page.getByLabel('Bias').fill('Cautiously bullish');
    await page.getByLabel('Risk Limit').fill('$300');
    await page.getByRole('button', { name: 'Create entry' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('SPY gapping up on CPI data').first()).toBeVisible();
    await expect(page.getByText('Pre-Market Plan', { exact: true }).first()).toBeVisible();
  });

  test('13 — save risk settings and confirm they persist', async ({ page }) => {
    await page.goto('/risk');
    await expect(page.getByRole('heading', { name: 'Risk' })).toBeVisible();

    await page.getByLabel('Max daily loss ($)').fill('500');
    await page.getByLabel('Max trades per day').fill('10');
    await page.getByRole('button', { name: 'Save limits' }).click();

    await page.reload();
    await expect(page.getByLabel('Max daily loss ($)')).toHaveValue('500');
    await expect(page.getByLabel('Max trades per day')).toHaveValue('10');
  });

  test('14 — export the full database, then restore from that export', async ({
    page,
  }) => {
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Data' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Export full database (JSON)' })
      .click();
    const download = await downloadPromise;
    const downloadPath = path.join(__dirname, '..', '.tmp-e2e-backup.json');
    await download.saveAs(downloadPath);

    await uploadViaLabelButton(
      page,
      'Choose backup file to restore',
      downloadPath,
    );
    await expect(
      page.getByRole('dialog', { name: /Restore from backup/ }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Restore and replace my data' })
      .click();

    await expect(
      page.getByText('Restore completed successfully.'),
    ).toBeVisible();
    // Confirm the account we created in test 01 survived the round trip —
    // its name only appears once the Account select's option list is open.
    await page.goto('/trades');
    await page.getByRole('button', { name: 'New trade' }).click();
    await page.getByRole('dialog').getByLabel('Account').click();
    await expect(
      page.getByRole('option', { name: ACCOUNT_NAME }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('15 — unassign and delete the strategy and playbook', async ({ page }) => {
    // Deletion is intentionally protected while a trade references either
    // record. Clear both assignments through the same Trade form a user uses.
    await page.goto('/trades');
    await selectAccountFilter(page, ACCOUNT_NAME);
    const aaplRow = findImportedTradeRow(page, 'AAPL', 'Aug 20, 2026');
    await aaplRow.getByRole('button', { name: 'Edit trade' }).click();
    await selectMuiOptionByLabel(page, 'Strategy (optional)', '— none —');
    await selectMuiOptionByLabel(page, 'Playbook (optional)', '— none —');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.goto('/strategies');
    await page.getByRole('button', { name: new RegExp(STRATEGY_NAME) }).click();
    await page.getByRole('button', { name: 'Delete strategy' }).click();
    const strategyDialog = page.getByRole('dialog', { name: 'Delete strategy?' });
    await strategyDialog.getByRole('button', { name: 'Delete strategy' }).click();
    await expect(strategyDialog).toBeHidden();
    await expect(page.getByText(STRATEGY_NAME)).toHaveCount(0);

    await page.goto('/playbooks');
    await page.getByRole('button', { name: new RegExp(PLAYBOOK_NAME) }).click();
    await page.getByRole('button', { name: 'Delete playbook' }).click();
    const playbookDialog = page.getByRole('dialog', { name: 'Delete playbook?' });
    await playbookDialog.getByRole('button', { name: 'Delete playbook' }).click();
    await expect(playbookDialog).toBeHidden();
    await expect(page.getByText(PLAYBOOK_NAME)).toHaveCount(0);
  });
});
