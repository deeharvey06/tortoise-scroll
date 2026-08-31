/**
 * API smoke test — a fast "is the MVP path even wired up" check that needs
 * no browser, just a running server (and MongoDB). Complements the
 * Playwright E2E suite in /e2e, which drives the real UI; this only proves
 * the API surface itself is intact, in seconds rather than minutes.
 *
 * Usage:
 *   1. Start MongoDB and the server (npm run dev --prefix server), or the
 *      whole app (npm run dev from the repo root).
 *   2. node server/scripts/apiSmokeTest.js
 *
 * Exits with code 0 and prints "ALL CHECKS PASSED" on success, or exits
 * non-zero with the first failing check printed — suitable as a CI gate
 * (e.g. a pre-deploy or pre-merge check) without needing a browser runner.
 *
 * Cleans up every record it creates (account, trade, strategy, playbook)
 * at the end, in a finally block, so it's safe to run repeatedly against a
 * real development database without accumulating test data.
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5050/api';

const created = {
  accountId: null,
  tradeId: null,
  strategyId: null,
  playbookId: null,
};
const results = [];

async function check(name, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - start });
    console.log(`  ✓ ${name} (${Date.now() - start}ms)`);
  } catch (err) {
    results.push({
      name,
      ok: false,
      error: err.message,
      ms: Date.now() - start,
    });
    console.error(`  ✗ ${name} — ${err.message}`);
    throw err; // stop the run at the first failure; order matters here
  }
}

async function req(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response (e.g. 204 No Content) — fine
  }
  return { status: res.status, body: json, raw: text };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log(`API smoke test against ${BASE_URL}\n`);

  await check('GET /health returns ok', async () => {
    const { status, body } = await req('GET', '/health');
    assert(status === 200, `expected 200, got ${status}`);
    assert(body?.status === 'ok', 'expected {status: "ok"}');
  });

  await check('POST /accounts creates an account', async () => {
    const { status, body } = await req('POST', '/accounts', {
      name: `[SMOKE TEST] Account ${Date.now()}`,
      currency: 'USD',
      startingBalance: 10000,
    });
    assert(
      status === 201,
      `expected 201, got ${status}: ${JSON.stringify(body)}`,
    );
    assert(body?._id, 'expected created account to have an _id');
    created.accountId = body._id;
  });

  await check(
    'POST /trades creates a trade with computed financials',
    async () => {
      const { status, body } = await req('POST', '/trades', {
        accountId: created.accountId,
        symbol: 'SMOKE',
        direction: 'long',
        quantity: 100,
        entryPrice: 10,
        exitPrice: 11,
        entryTime: '2026-01-01T14:30:00Z',
        exitTime: '2026-01-01T14:45:00Z',
        riskAmount: 100,
        fees: 0,
        commission: 0,
      });
      assert(
        status === 201,
        `expected 201, got ${status}: ${JSON.stringify(body)}`,
      );
      assert(
        body?.netPnL === 100,
        `expected netPnL 100 (deterministic calc), got ${body?.netPnL}`,
      );
      assert(
        body?.rMultiple === 1,
        `expected rMultiple 1, got ${body?.rMultiple}`,
      );
      created.tradeId = body._id;
    },
  );

  await check(
    'POST /trades rejects a trade without required fields',
    async () => {
      const { status, body } = await req('POST', '/trades', {
        accountId: created.accountId,
        symbol: 'INVALID',
      });
      assert(
        status === 400,
        `expected validation failure 400, got ${status}: ${JSON.stringify(body)}`,
      );
      assert(
        body?.error?.message,
        'expected a useful validation error message',
      );
    },
  );

  await check('GET /trades lists the created trade', async () => {
    const { status, body } = await req(
      'GET',
      `/trades?accountId=${created.accountId}`,
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(
      body?.items?.some((t) => t._id === created.tradeId),
      'created trade not found in list',
    );
  });

  await check(
    'GET /analytics/dashboard returns a real summary for the account',
    async () => {
      const { status, body } = await req(
        'GET',
        `/analytics/dashboard?accountId=${created.accountId}`,
      );
      assert(status === 200, `expected 200, got ${status}`);
      assert(
        body?.summary?.netPnL === 100,
        `expected dashboard netPnL 100, got ${body?.summary?.netPnL}`,
      );
      assert(Array.isArray(body?.equityCurve), 'expected equityCurve array');
    },
  );

  await check('GET /analytics/calendar returns the trading day', async () => {
    const { status, body } = await req(
      'GET',
      `/analytics/calendar?year=2026&month=1&accountId=${created.accountId}`,
    );
    assert(status === 200, `expected 200, got ${status}`);
    const day = body?.days?.find((d) => d.date === '2026-01-01');
    assert(day?.netPnL === 100, `expected day netPnL 100, got ${day?.netPnL}`);
  });

  await check('POST /strategies creates a strategy', async () => {
    const { status, body } = await req('POST', '/strategies', {
      name: `[SMOKE TEST] Strategy ${Date.now()}`,
    });
    assert(status === 201, `expected 201, got ${status}`);
    created.strategyId = body._id;
  });

  await check('POST /playbooks creates a playbook', async () => {
    const { status, body } = await req('POST', '/playbooks', {
      setupName: `[SMOKE TEST] Playbook ${Date.now()}`,
    });
    assert(status === 201, `expected 201, got ${status}`);
    created.playbookId = body._id;
  });

  await check('PUT /trades/:id assigns strategy + playbook', async () => {
    const { status, body } = await req('PUT', `/trades/${created.tradeId}`, {
      strategy: created.strategyId,
      playbook: created.playbookId,
    });
    assert(status === 200, `expected 200, got ${status}`);
    assert(
      body?.strategy === created.strategyId,
      'strategy assignment did not persist',
    );
    assert(
      body?.playbook === created.playbookId,
      'playbook assignment did not persist',
    );
  });

  await check('GET /trades filters by playbook', async () => {
    const { status, body } = await req(
      'GET',
      `/trades?playbook=${created.playbookId}`,
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(
      body?.pagination?.total === 1,
      `expected one playbook trade, got ${body?.pagination?.total}`,
    );
    assert(
      body.items[0]?._id === created.tradeId,
      'playbook filter returned the wrong trade',
    );
  });

  await check(
    'POST /backup/import rejects an unconfirmed restore',
    async () => {
      const { status, body } = await req('POST', '/backup/import', {
        data: {},
      });
      assert(
        status === 400,
        `expected 400, got ${status}: ${JSON.stringify(body)}`,
      );
      assert(
        body?.error?.message?.includes('explicit confirmation'),
        'expected confirmation error',
      );
    },
  );

  await check(
    'GET /strategies/:id/performance reflects the assigned trade',
    async () => {
      const { status, body } = await req(
        'GET',
        `/strategies/${created.strategyId}/performance`,
      );
      assert(status === 200, `expected 200, got ${status}`);
      assert(
        body?.totalTrades === 1,
        `expected 1 trade rolled up, got ${body?.totalTrades}`,
      );
    },
  );

  await check('PUT /risk/settings saves and GET reflects it', async () => {
    const putRes = await req('PUT', '/risk/settings', {
      accountId: created.accountId,
      maxDailyLoss: 500,
    });
    assert(putRes.status === 200, `expected 200, got ${putRes.status}`);
    const getRes = await req(
      'GET',
      `/risk/dashboard?accountId=${created.accountId}`,
    );
    assert(getRes.status === 200, `expected 200, got ${getRes.status}`);
    assert(
      getRes.body?.settings?.maxDailyLoss === 500,
      'risk setting did not persist',
    );
  });

  await check('GET /backup/export returns a full JSON dump', async () => {
    const { status, body } = await req('GET', '/backup/export');
    assert(status === 200, `expected 200, got ${status}`);
    assert(
      Array.isArray(body?.data?.trades),
      'expected data.trades array in export',
    );
    assert(
      body.data.trades.some((t) => t._id === created.tradeId),
      'created trade missing from export',
    );
  });

  // Deletion + its safety guard are asserted here, not left to best-effort
  // cleanup — "can I actually delete things, and does it protect
  // referenced records" is itself part of what this smoke test verifies.
  await check(
    'DELETE /accounts/:id is blocked (409) while a trade still references it',
    async () => {
      const { status } = await req('DELETE', `/accounts/${created.accountId}`);
      assert(status === 409, `expected 409, got ${status}`);
    },
  );

  await check('DELETE /trades/:id removes the trade', async () => {
    const { status } = await req('DELETE', `/trades/${created.tradeId}`);
    assert(status === 204, `expected 204, got ${status}`);
    created.tradeId = null;
  });

  await check(
    'DELETE /strategies/:id succeeds once no trade references it',
    async () => {
      const { status } = await req(
        'DELETE',
        `/strategies/${created.strategyId}`,
      );
      assert(status === 204, `expected 204, got ${status}`);
      created.strategyId = null;
    },
  );

  await check(
    'DELETE /playbooks/:id succeeds once no trade references it',
    async () => {
      const { status } = await req(
        'DELETE',
        `/playbooks/${created.playbookId}`,
      );
      assert(status === 204, `expected 204, got ${status}`);
      created.playbookId = null;
    },
  );

  await check('DELETE /accounts/:id now succeeds', async () => {
    const { status } = await req('DELETE', `/accounts/${created.accountId}`);
    assert(status === 204, `expected 204, got ${status}`);
    created.accountId = null;
  });
}

async function cleanup() {
  // Best-effort only — if every check above passed, there's nothing left
  // to clean up. This only matters if a check failed partway through and
  // threw before reaching the deletion steps.
  const leftovers = Object.entries(created).filter(([, v]) => v);
  if (leftovers.length === 0) return;
  console.log('\nRemoving leftover smoke-test data from the failed run...');
  if (created.tradeId)
    await req('DELETE', `/trades/${created.tradeId}`).catch(() => {});
  if (created.strategyId)
    await req('DELETE', `/strategies/${created.strategyId}`).catch(() => {});
  if (created.playbookId)
    await req('DELETE', `/playbooks/${created.playbookId}`).catch(() => {});
  if (created.accountId)
    await req('DELETE', `/accounts/${created.accountId}`).catch(() => {});
}

main()
  .then(async () => {
    await cleanup();
    console.log('\nALL CHECKS PASSED');
    process.exit(0);
  })
  .catch(async (err) => {
    await cleanup();
    console.error('\nSMOKE TEST FAILED:', err.message);
    process.exit(1);
  });
