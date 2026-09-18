import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  setupReplay,
  createInput,
  OWNER,
  OTHER,
} from './fixtures/replay/helpers.js';
import { uploadsRootPath } from '../src/middleware/upload.js';
const code = (expected) => (error) => error.code === expected;

test('runs persist independently and creation returns no future candles or historical snapshot', async (t) => {
  const { service, captured, records } = await setupReplay(t);
  const view = await service.create(OWNER, createInput);
  assert.equal(view.cursor, -1);
  assert.deepEqual(view.candles, []);
  assert.equal(view.historicalTrades, undefined);
  assert.equal(captured[0].userId, OWNER);
  assert.equal(records.size, 1);
  assert.equal((await service.list(OWNER)).length, 1);
  assert.deepEqual(await service.list(OTHER), []);
  assert.equal((await service.datasets(OWNER)).length, 1);
});

test('decisions bind to server cursor/time, preserve confidence/reasoning, and cannot alter historical trades', async (t) => {
  const { service, records } = await setupReplay(t);
  const created = await service.create(OWNER, createInput);
  const decision = {
    kind: 'decision',
    action: 'Long',
    confidence: 4,
    text: 'Wait for confirmation',
    version: 0,
  };
  const saved = await service.addEvent(OWNER, created.id, decision);
  assert.equal(saved.events[0].cursor, -1);
  assert.equal(saved.events[0].timestamp, '2026-03-09T13:30:00.000Z');
  assert.equal(saved.events[0].afterExposure, false);
  assert.equal(saved.events[0].confidence, 4);
  assert.deepEqual(records.get(created.id).historicalTrades, []);
  await assert.rejects(
    () =>
      service.removeEvent(OWNER, created.id, saved.events[0]._id, {
        version: 1,
      }),
    code('REPLAY_EVENT_LOCKED')
  );
  await assert.rejects(
    () =>
      service.addEvent(OWNER, created.id, {
        ...decision,
        version: 1,
        timestamp: '2030-01-01T00:00:00Z',
      }),
    code('REPLAY_INVALID_INPUT')
  );
});

test('stepping, resume, backward scrubbing and reveal apply on the server with optimistic versions', async (t) => {
  const { service } = await setupReplay(t);
  const created = await service.create(OWNER, createInput);
  const one = await service.control(OWNER, created.id, {
    action: 'step',
    count: 1,
    version: 0,
  });
  assert.equal(one.candles.length, 1);
  assert.equal(one.timestamp, '2026-03-09T13:31:00.000Z');
  await assert.rejects(
    () =>
      service.control(OWNER, created.id, {
        action: 'step',
        count: 1,
        version: 0,
      }),
    code('REPLAY_CONFLICT')
  );
  await assert.rejects(
    () =>
      service.control(OWNER, created.id, {
        action: 'seek',
        cursor: 2,
        version: 1,
      }),
    code('REPLAY_INVALID_SEEK')
  );
  const end = await service.control(OWNER, created.id, {
    action: 'step',
    count: 100,
    version: 1,
  });
  assert.equal(end.complete, true);
  assert.equal(end.candles.length, 3);
  const reveal = await service.control(OWNER, created.id, {
    action: 'reveal',
    version: 2,
  });
  assert.deepEqual(reveal.comparison, []);
  const rewind = await service.control(OWNER, created.id, {
    action: 'seek',
    cursor: 0,
    version: 3,
  });
  assert.equal(rewind.candles.length, 1);
  assert.equal(rewind.comparison, null);
  assert.equal(rewind.afterExposure, true);
  assert.deepEqual(await service.get(OWNER, created.id), rewind);
  const decision = await service.addEvent(OWNER, created.id, {
    kind: 'decision',
    action: 'Wait',
    confidence: 1,
    text: 'Seen later bars',
    version: 4,
  });
  assert.equal(decision.events[0].afterExposure, true);
});

for (const method of [
  'get',
  'control',
  'addEvent',
  'removeEvent',
  'screenshot',
  'screenshotPath',
]) {
  test(`${method} rejects direct access to another owner's run`, async (t) => {
    const { service } = await setupReplay(t);
    const created = await service.create(OWNER, createInput);
    const args =
      method === 'control'
        ? [{ action: 'step', count: 1, version: 0 }]
        : method === 'addEvent'
          ? [{ kind: 'note', text: 'foreign', version: 0 }]
          : method === 'removeEvent'
            ? ['id', { version: 0 }]
            : method === 'screenshot'
              ? [{ version: 0 }, null]
              : method === 'screenshotPath'
                ? ['id']
                : [];
    await assert.rejects(
      () => service[method](OTHER, created.id, ...args),
      code('REPLAY_NOT_FOUND')
    );
  });
}

test('client ownership, invalid commands and bad IDs are rejected', async (t) => {
  const { service } = await setupReplay(t);
  await assert.rejects(
    () => service.create(OWNER, { ...createInput, userId: OTHER }),
    code('REPLAY_INVALID_INPUT')
  );
  await assert.rejects(
    () => service.get(OWNER, '../'),
    code('REPLAY_NOT_FOUND')
  );
  const created = await service.create(OWNER, createInput);
  for (const count of [-1, 0, 101, 1.5])
    await assert.rejects(
      () =>
        service.control(OWNER, created.id, {
          action: 'step',
          count,
          version: 0,
        }),
      code('REPLAY_INVALID_INPUT')
    );
  await assert.rejects(
    () => service.control(OWNER, created.id, { action: 'reveal', version: 0 }),
    code('REPLAY_NOT_FINISHED')
  );
});

test('missing candles fail before replay, and source edits invalidate an existing run without erasing decisions', async (t) => {
  const { service, csvPath, records } = await setupReplay(t);
  const created = await service.create(OWNER, createInput);
  await service.addEvent(OWNER, created.id, {
    kind: 'decision',
    action: 'Short',
    confidence: 3,
    text: 'Recorded',
    version: 0,
  });
  await writeFile(
    csvPath,
    'timestamp,open,high,low,close\n2026-03-09T13:30:00Z,100,102,99,101\n'
  );
  await assert.rejects(
    () => service.create(OWNER, createInput),
    code('REPLAY_INCOMPLETE_DATA')
  );
  await assert.rejects(
    () => service.get(OWNER, created.id),
    code('REPLAY_SOURCE_CHANGED')
  );
  assert.equal(records.get(created.id).events[0].text, 'Recorded');
});

test('run cannot end inside a still-open candle', async (t) => {
  const { service } = await setupReplay(t);
  await assert.rejects(
    () => service.create(OWNER, { ...createInput, to: '2026-03-09T13:32:30Z' }),
    code('REPLAY_PARTIAL_BAR')
  );
});

test('annotations are cursor-gated, drawings stay on revealed bars, and notes/drawings can be removed', async (t) => {
  const { service } = await setupReplay(t);
  const created = await service.create(OWNER, createInput);
  await assert.rejects(
    () =>
      service.addEvent(OWNER, created.id, {
        kind: 'line',
        lineType: 'stop',
        price: 98,
        version: 0,
      }),
    code('REPLAY_INVALID_DRAWING')
  );
  await service.control(OWNER, created.id, {
    action: 'step',
    count: 2,
    version: 0,
  });
  for (const lineType of ['stop', 'target', 'level']) {
    const view = await service.get(OWNER, created.id);
    await service.addEvent(OWNER, created.id, {
      kind: 'line',
      lineType,
      price: 100,
      text: 'Plan',
      version: view.version,
    });
  }
  let view = await service.get(OWNER, created.id);
  await assert.rejects(
    () =>
      service.addEvent(OWNER, created.id, {
        kind: 'line',
        lineType: 'trend',
        price: 100,
        endPrice: 101,
        startCursor: 0,
        endCursor: 2,
        version: view.version,
      }),
    code('REPLAY_INVALID_DRAWING')
  );
  view = await service.addEvent(OWNER, created.id, {
    kind: 'line',
    lineType: 'trend',
    price: 100,
    endPrice: 101,
    startCursor: 0,
    endCursor: 1,
    version: view.version,
  });
  view = await service.addEvent(OWNER, created.id, {
    kind: 'note',
    text: 'Setup annotation',
    version: view.version,
  });
  view = await service.removeEvent(OWNER, created.id, view.events.at(-1)._id, {
    version: view.version,
  });
  assert.equal(view.events.length, 4);
  view = await service.control(OWNER, created.id, {
    action: 'seek',
    cursor: -1,
    version: view.version,
  });
  assert.equal(view.events.length, 0);
});

test('saved screenshot access is owner/cursor gated and stale upload cleanup prevents orphan files', async (t) => {
  const { service } = await setupReplay(t);
  const created = await service.create(OWNER, createInput);
  const dir = path.join(uploadsRootPath, 'replay', OWNER, created.id);
  t.after(() => rm(dir, { recursive: true, force: true }));
  await service.control(OWNER, created.id, {
    action: 'step',
    count: 1,
    version: 0,
  });
  const file = {
    mimetype: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV9sAAAAASUVORK5CYII=',
      'base64'
    ),
  };
  await assert.rejects(
    () => service.screenshot(OWNER, created.id, { version: 1 }, null),
    code('REPLAY_INVALID_IMAGE')
  );
  const saved = await service.screenshot(
    OWNER,
    created.id,
    { version: 1, caption: 'Visible chart' },
    file
  );
  assert.equal(saved.screenshots.length, 1);
  const shot = saved.screenshots[0];
  assert.ok(
    (await service.screenshotPath(OWNER, created.id, shot.id)).endsWith(
      `${shot.id}.png`
    )
  );
  await assert.rejects(
    () => service.screenshotPath(OWNER, created.id, '../'),
    code('REPLAY_NOT_FOUND')
  );
  await assert.rejects(
    () => service.screenshot(OWNER, created.id, { version: 1 }, file),
    code('REPLAY_CONFLICT')
  );
  const rewound = await service.control(OWNER, created.id, {
    action: 'seek',
    cursor: -1,
    version: 2,
  });
  assert.deepEqual(rewound.screenshots, []);
  await assert.rejects(
    () => service.screenshotPath(OWNER, created.id, shot.id),
    code('REPLAY_NOT_FOUND')
  );
});

test('owned historical snapshots retain legacy manual trades without executions and never return private snapshots', async (t) => {
  const trade = {
    _id: OWNER,
    symbol: 'AAPL',
    direction: 'long',
    quantity: 1,
    entryPrice: 100,
    exitPrice: 102,
    entryTime: createInput.from,
    exitTime: createInput.to,
    netPnL: 2,
    notes: 'Original journal',
    setup: 'Opening range',
  };
  const { service, records, captured } = await setupReplay(t, [trade]);
  const created = await service.create(OWNER, {
    ...createInput,
    mode: 'review',
  });
  assert.equal(captured[0].userId, OWNER);
  assert.deepEqual(records.get(created.id).historicalTrades[0].executions, []);
  assert.equal(created.comparison, null);
  const end = await service.control(OWNER, created.id, {
    action: 'step',
    count: 3,
    version: 0,
  });
  assert.deepEqual(
    end.markers.map((item) => item.kind),
    ['entry', 'exit']
  );
  const revealed = await service.control(OWNER, created.id, {
    action: 'reveal',
    version: 1,
  });
  assert.equal(revealed.comparison[0].notes, 'Original journal');
  assert.equal(revealed.comparison[0].netPnL, 2);
  assert.equal(revealed.historicalTrades, undefined);
});
