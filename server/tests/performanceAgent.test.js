import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDeviations, tagAssociationFindings } from '../src/agents/performanceAgent.js';

const overall = { winRate: 50, avgR: 0.5, closedTrades: 100 };

test('flags a group whose win rate deviates past the threshold with sufficient sample size', () => {
  const groups = [{ label: 'open', key: 'open', count: 20, winRate: 70, avgR: 0.5 }];
  const findings = findDeviations(groups, overall, 'session');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /significantly better/);
  assert.match(findings[0], /20 trades/);
});

test('does not flag a group below the minimum sample size, even with a huge deviation', () => {
  const groups = [{ label: 'pre-market', key: 'pre-market', count: 5, winRate: 95, avgR: 2 }];
  const findings = findDeviations(groups, overall, 'session');
  assert.equal(findings.length, 0);
});

test('does not flag a group whose deviation is below the threshold', () => {
  const groups = [{ label: 'mid-day', key: 'mid-day', count: 20, winRate: 55, avgR: 0.55 }];
  const findings = findDeviations(groups, overall, 'session');
  assert.equal(findings.length, 0);
});

test('flags avg R deviation independently of win rate deviation', () => {
  const groups = [{ label: 'power-hour', key: 'power-hour', count: 15, winRate: 50, avgR: 1.2 }];
  const findings = findDeviations(groups, overall, 'session');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /average R/);
});

test('tag association findings phrase results as correlation, never causation', () => {
  const closedTrades = [
    { netPnL: 100, mistake: [] },
    { netPnL: 100, mistake: [] },
    { netPnL: -300, mistake: ['FOMO'] },
    { netPnL: -280, mistake: ['FOMO'] },
    { netPnL: -320, mistake: ['FOMO'] },
    { netPnL: -290, mistake: ['FOMO'] },
    { netPnL: -310, mistake: ['FOMO'] },
  ];
  const findings = tagAssociationFindings(closedTrades, 'mistake', 'mistake');
  assert.ok(findings.length >= 1);
  assert.match(findings[0], /association observed in the data, not a proven cause/);
  assert.match(findings[0], /5 trade/);
});

test('tag association findings require the minimum tag sample size', () => {
  const closedTrades = [
    { netPnL: 100, mistake: [] },
    { netPnL: -500, mistake: ['RareMistake'] },
    { netPnL: -500, mistake: ['RareMistake'] },
  ];
  const findings = tagAssociationFindings(closedTrades, 'mistake', 'mistake');
  assert.equal(findings.length, 0, 'only 2 instances of the tag — below the 5-trade minimum');
});
