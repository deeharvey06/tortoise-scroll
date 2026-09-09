import { test, expect, request as playwrightRequest } from '@playwright/test';

const csrfHeaders = { 'X-CSRF-Protection': '1' };
const uniqueUser = (label) => ({
  displayName: label,
  email: `${label.toLowerCase().replaceAll(' ', '-')}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`,
  password: `${label.toLowerCase().replaceAll(' ', '-')}-password-123`,
});

async function loginRoot(request) {
  const response = await request.post('/api/auth/login', {
    data: {
      email: 'e2e-root@tortoise-scroll.test',
      password: 'e2e-root-password-strong-123',
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test('direct API rejects CSRF-less and cross-origin authentication requests', async () => {
  const api = await playwrightRequest.newContext({
    baseURL: 'http://localhost:5050',
  });
  try {
    const missing = await api.post('/api/auth/login', {
      headers: { 'X-CSRF-Protection': '' },
      data: { email: 'nobody@example.test', password: 'invalid' },
    });
    expect(missing.status()).toBe(403);
    const malicious = await api.post('/api/auth/login', {
      headers: { ...csrfHeaders, Origin: 'https://malicious.example' },
      data: { email: 'nobody@example.test', password: 'invalid' },
    });
    expect(malicious.status()).toBe(403);
  } finally {
    await api.dispose();
  }
});

test('direct API rejects public privilege escalation and every ROOT mutation', async ({
  request,
}) => {
  const root = await loginRoot(request);
  const candidate = uniqueUser('Escalation User');
  expect(
    (
      await request.post('/api/auth/register', {
        data: {
          ...candidate,
          role: 'ROOT',
          status: 'ACTIVE',
          permissions: ['*'],
        },
      })
    ).status(),
  ).toBe(400);
  const created = await request.post('/api/auth/register', { data: candidate });
  expect(created.status()).toBe(201);
  const candidateId = (await created.json()).user.id;
  expect(
    (
      await request.patch(`/api/admin/users/${candidateId}/role`, {
        data: { role: 'ROOT' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.patch(`/api/admin/users/${root.user.id}/role`, {
        data: { role: 'USER' },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.patch(`/api/admin/users/${root.user.id}/status`, {
        data: { status: 'SUSPENDED' },
      })
    ).status(),
  ).toBe(404);
  expect(
    (await request.delete(`/api/admin/users/${root.user.id}`)).status(),
  ).toBe(404);
});

test('ADMIN has read-only administration UI and cannot target ROOT through direct APIs', async ({
  page,
}) => {
  const api = page.request;
  const root = await loginRoot(api);
  const admin = uniqueUser('E2E Admin');
  const regular = uniqueUser('E2E Regular');
  const adminCreated = await api.post('/api/auth/register', {
    data: admin,
  });
  const regularCreated = await api.post('/api/auth/register', {
    data: regular,
  });
  const adminId = (await adminCreated.json()).user.id;
  const regularId = (await regularCreated.json()).user.id;
  expect(
    (
      await api.patch(`/api/admin/users/${adminId}/role`, {
        data: { role: 'ADMIN' },
      })
    ).ok(),
  ).toBeTruthy();
  await api.post('/api/auth/logout');
  expect(
    (
      await api.post('/api/auth/login', {
        data: { email: admin.email, password: admin.password },
      })
    ).ok(),
  ).toBeTruthy();

  await page.goto('/administration');
  await expect(
    page.getByRole('heading', { name: 'Administration' }),
  ).toBeVisible();
  await expect(page.getByText(regular.email, { exact: true })).toBeVisible();
  await expect(page.getByText('Read only').first()).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Audit log' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Suspend' })).toHaveCount(0);

  expect(
    (
      await api.patch(`/api/admin/users/${regularId}/role`, {
        data: { role: 'ADMIN' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await api.patch(`/api/admin/users/${regularId}/status`, {
        data: { status: 'SUSPENDED' },
      })
    ).status(),
  ).toBe(403);
  expect((await api.get('/api/admin/audit-log')).status()).toBe(403);
  expect((await api.get(`/api/admin/users/${root.user.id}`)).status()).toBe(
    404,
  );
});

test('suspension invalidates an active USER session and blocks another login', async ({
  request,
}) => {
  await loginRoot(request);
  const user = uniqueUser('Suspended User');
  const created = await request.post('/api/auth/register', { data: user });
  const userId = (await created.json()).user.id;
  const userApi = await playwrightRequest.newContext({
    baseURL: 'http://localhost:5050',
    extraHTTPHeaders: csrfHeaders,
  });
  try {
    expect(
      (
        await userApi.post('/api/auth/login', {
          data: { email: user.email, password: user.password },
        })
      ).status(),
    ).toBe(200);
    expect((await userApi.get('/api/auth/me')).status()).toBe(200);
    expect(
      (
        await request.patch(`/api/admin/users/${userId}/status`, {
          data: { status: 'SUSPENDED' },
        })
      ).status(),
    ).toBe(200);
    expect((await userApi.get('/api/auth/me')).status()).toBe(403);
    expect((await userApi.get('/api/auth/me')).status()).toBe(401);
    expect(
      (
        await userApi.post('/api/auth/login', {
          data: { email: user.email, password: user.password },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await userApi.dispose();
  }
});

test('USER B cannot read, edit, or delete USER A trade through direct APIs', async () => {
  const userA = uniqueUser('Isolation A');
  const userB = uniqueUser('Isolation B');
  const apiA = await playwrightRequest.newContext({
    baseURL: 'http://localhost:5050',
    extraHTTPHeaders: csrfHeaders,
  });
  const apiB = await playwrightRequest.newContext({
    baseURL: 'http://localhost:5050',
    extraHTTPHeaders: csrfHeaders,
  });
  try {
    for (const [api, user] of [
      [apiA, userA],
      [apiB, userB],
    ]) {
      expect(
        (await api.post('/api/auth/register', { data: user })).status(),
      ).toBe(201);
      expect(
        (
          await api.post('/api/auth/login', {
            data: { email: user.email, password: user.password },
          })
        ).status(),
      ).toBe(200);
    }
    const accountResponse = await apiA.post('/api/accounts', {
      data: { name: `Isolation Account ${Date.now()}` },
    });
    expect(accountResponse.status()).toBe(201);
    const account = await accountResponse.json();
    const tradeResponse = await apiA.post('/api/trades', {
      data: {
        accountId: account._id,
        symbol: 'ES',
        direction: 'long',
        quantity: 1,
        entryPrice: 6000,
        entryTime: new Date().toISOString(),
        notes: 'owned by A',
      },
    });
    expect(tradeResponse.status()).toBe(201);
    const trade = await tradeResponse.json();

    expect((await apiB.get(`/api/trades/${trade._id}`)).status()).toBe(404);
    expect(
      (
        await apiB.put(`/api/trades/${trade._id}`, {
          data: { notes: 'stolen by B' },
        })
      ).status(),
    ).toBe(404);
    expect((await apiB.delete(`/api/trades/${trade._id}`)).status()).toBe(404);
    const ownerRead = await apiA.get(`/api/trades/${trade._id}`);
    expect(ownerRead.status()).toBe(200);
    expect((await ownerRead.json()).notes).toBe('owned by A');
  } finally {
    await apiA.dispose();
    await apiB.dispose();
  }
});

test('ROOT administration UI renders in explicit light and dark themes', async ({
  page,
}) => {
  await loginRoot(page.request);
  await page.goto('/administration');
  for (const mode of ['light', 'dark']) {
    await page.evaluate(
      (value) => localStorage.setItem('tortoise-scroll-theme', value),
      mode,
    );
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Administration' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    await expect(page.getByRole('tab', { name: 'Audit log' })).toBeVisible();
  }
});
