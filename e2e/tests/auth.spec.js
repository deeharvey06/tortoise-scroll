import { test, expect } from '@playwright/test';

const uniqueUser = () => ({
  displayName: 'Phase Two User',
  email: `phase2-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`,
  password: 'phase-two-password-123',
});

async function registerFromUi(page, user) {
  await page.goto('/register');
  await page.getByLabel('Display name').fill(user.displayName);
  await page.getByLabel('Email').fill(user.email);
  await page
    .getByRole('textbox', { name: 'Password', exact: true })
    .fill(user.password);
  await page
    .getByRole('textbox', { name: 'Confirm password', exact: true })
    .fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
}

test('new USER registers and no privilege controls are exposed', async ({
  page,
}) => {
  const user = uniqueUser();
  await page.goto('/register');
  await expect(page.getByLabel(/role|admin|root|status/i)).toHaveCount(0);
  await registerFromUi(page, user);
  await expect(page.getByText('Account created')).toBeVisible();
});

test('registration validation and duplicate errors are visible', async ({
  page,
  request,
}) => {
  const user = uniqueUser();
  await request.post('/api/auth/register', { data: user });
  await registerFromUi(page, user);
  await expect(page.getByRole('alert')).toContainText('already exists');
});

test('valid login persists through refresh and logout protects the app', async ({
  page,
  request,
}) => {
  const user = uniqueUser();
  await request.post('/api/auth/register', { data: user });
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page
    .getByRole('textbox', { name: 'Password', exact: true })
    .fill(user.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await page.getByLabel('Open account menu').click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/trades');
  await expect(page).toHaveURL(/\/login$/);
});

test('invalid credentials show an error and do not redirect', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('unknown@example.test');
  await page
    .getByRole('textbox', { name: 'Password', exact: true })
    .fill('incorrect');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Invalid email or password',
  );
  await expect(page).toHaveURL(/\/login$/);
});

test('unauthenticated visitor cannot see protected content', async ({
  page,
}) => {
  await page.goto('/trades');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
});

test('USER is denied admin and root routes', async ({ page, request }) => {
  const user = uniqueUser();
  await request.post('/api/auth/register', { data: user });
  await page.request.post('/api/auth/login', {
    data: { email: user.email, password: user.password },
  });
  for (const path of ['/administration', '/root']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'Access denied' }),
    ).toBeVisible();
  }
});

test('test ROOT may access the root UX route', async ({ page, request }) => {
  const login = await page.request.post('/api/auth/login', {
    data: {
      email: 'e2e-root@tortoise-scroll.test',
      password: 'e2e-root-password-strong-123',
    },
  });
  expect(login.ok()).toBeTruthy();
  await page.goto('/root');
  await expect(
    page.getByRole('heading', { name: 'Root administration' }),
  ).toBeVisible();
});

test.describe('auth themes and responsive layout', () => {
  for (const mode of ['light', 'dark'])
    test(`Sign In and Register render in ${mode} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode });
      for (const path of ['/login', '/register']) {
        await page.goto(path);
        await expect(page.locator('main')).toBeVisible();
      }
    });
  test('auth view is usable at a mobile viewport without console errors', async ({
    page,
  }) => {
    const errors = [];
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !message.text().includes('status of 401 (Unauthorized)')
      ) {
        errors.push(message.text());
      }
    });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    await expect(page.locator('main')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
