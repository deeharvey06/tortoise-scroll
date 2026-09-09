import { expect } from '@playwright/test';

/**
 * Registers (when needed) and authenticates through the real cookie-session API.
 * The request fixture shares its cookie jar with the browser context.
 */
export async function authenticateAsDemo(page, request) {
  const credentials = {
    email: 'e2e-user@tortoise-scroll.test',
    password: 'e2e-password-strong-123',
  };
  const api = page.request;
  await api.post('/api/auth/register', {
    data: { ...credentials, displayName: 'E2E User' },
  });
  const response = await api.post('/api/auth/login', {
    data: credentials,
  });
  expect(response.ok(), `E2E login failed: ${response.status()}`).toBeTruthy();
  return response.json();
}

/**
 * Opens and chooses an option from a labeled MUI <Select> (rendered via
 * TextField `select`). MUI wires the label to the select trigger via
 * aria, so getByLabel works for the trigger itself; the option list
 * renders in a portal, so it's queried globally rather than scoped.
 */
export async function selectMuiOptionByLabel(page, labelText, optionText) {
  const trigger = page.getByLabel(labelText, { exact: false });
  await trigger.click();
  await page.getByRole('option', { name: optionText, exact: true }).click();
}

/**
 * Same idea, but for the Import page's per-row mapping selects, which have
 * no individual accessible label — only the table row's first cell names
 * the field. Scopes to the row to find the trigger, but the popup option
 * list is queried globally since it renders in a portal.
 */
export async function selectMuiOptionInRow(page, rowText, optionText) {
  const row = page.locator('tr', { hasText: rowText });
  await row.locator('[role="combobox"], .MuiSelect-select').first().click();
  await page.getByRole('option', { name: optionText, exact: true }).click();
}

/**
 * Clicks a visible button/label whose text matches `buttonText` and sets
 * the file on the hidden <input type="file"> nested inside it — the
 * pattern used throughout this app for "Upload" / "Choose file" controls
 * (MUI Button component="label" wrapping a visually-hidden input).
 */
export async function uploadViaLabelButton(page, buttonText, filePath) {
  const container = page.locator('label', { hasText: buttonText }).first();
  const input = container.locator('input[type="file"]');
  await input.setInputFiles(filePath);
}

/**
 * Keeps the fixture flow deterministic even when the database already has demo
 * trades for the same symbol. Use the unique account created in the test to
 * scope the row lookup to that account instead of the first AAPL row in the DB.
 */
export async function selectAccountFilter(page, accountName) {
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByRole('combobox', { name: 'Account', exact: true }).click();
  await page.getByRole('option', { name: accountName, exact: true }).click();
  await page.keyboard.press('Escape');
}

export function findImportedTradeRow(page, symbol, fixtureDateText) {
  return page
    .locator('tr', { hasText: symbol })
    .filter({ hasText: fixtureDateText })
    .first();
}

/** Waits for and dismisses a success/info MUI Alert containing the given text. */
export async function expectAlert(page, text) {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
}

export default {
  authenticateAsDemo,
  selectMuiOptionByLabel,
  selectMuiOptionInRow,
  uploadViaLabelButton,
  selectAccountFilter,
  findImportedTradeRow,
  expectAlert,
};
