import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWarnings } from '../src/services/riskDashboardService.js';

test('buildWarnings reports approaching and reached daily loss limits', () => {
  const settings = { maxDailyLoss: 500 };

  assert.equal(buildWarnings(settings, { dailyPnL: -400 }).length, 1);
  assert.match(buildWarnings(settings, { dailyPnL: -500 })[0], /reached/);
});

test('buildWarnings reports weekly, streak, and trade-count limits', () => {
  const settings = {
    maxWeeklyLoss: 1000,
    maxConsecutiveLosses: 3,
    maxTradesPerDay: 5,
  };
  const warnings = buildWarnings(settings, {
    dailyPnL: 0,
    weeklyPnL: -1000,
    consecutiveLosses: 3,
    tradesToday: 5,
  });

  assert.equal(warnings.length, 3);
  assert.ok(warnings.some((warning) => warning.includes('Weekly loss limit')));
  assert.ok(warnings.some((warning) => warning.includes('consecutive losses')));
  assert.ok(warnings.some((warning) => warning.includes('trades today')));
});

test('buildWarnings does not report limits that are not configured', () => {
  assert.deepEqual(
    buildWarnings(
      {},
      {
        dailyPnL: -10000,
        weeklyPnL: -10000,
        consecutiveLosses: 10,
        tradesToday: 50,
      },
    ),
    [],
  );
  assert.deepEqual(buildWarnings(null, { dailyPnL: -10000 }), []);
});
