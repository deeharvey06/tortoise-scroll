import { z } from 'zod';
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import ReplayRun from '../../models/ReplayRun.js';
import Trade from '../../models/Trade.js';
import Strategy from '../../models/Strategy.js';
import * as marketDataService from '../marketDataService.js';
import { uploadsRootPath } from '../../middleware/upload.js';
import {
  ReplayError,
  projectReplay,
  replayTime,
  transition,
} from './replayEngine.js';

const version = z.number().int().min(0);
const createSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    mode: z.enum(['review', 'blind']),
    datasetId: z.string().min(1).max(64),
    symbol: z.string().max(64),
    timeframe: z.string().max(8),
    from: z.string(),
    to: z.string(),
    session: z
      .enum(['all', 'rth', 'eth', 'premarket', 'postmarket'])
      .default('all'),
  })
  .strict();
const controlSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('step'),
      count: z.number().int().min(1).max(100),
      version,
    })
    .strict(),
  z
    .object({
      action: z.literal('seek'),
      cursor: z.number().int().min(-1),
      version,
    })
    .strict(),
  z.object({ action: z.literal('reveal'), version }).strict(),
]);
const eventSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('decision'),
      action: z.enum(['Long', 'Short', 'Wait']),
      confidence: z.number().int().min(1).max(5),
      text: z.string().trim().min(1).max(2000),
      version,
    })
    .strict(),
  z
    .object({
      kind: z.literal('note'),
      text: z.string().trim().min(1).max(2000),
      version,
    })
    .strict(),
  z
    .object({
      kind: z.literal('line'),
      lineType: z.enum(['level', 'stop', 'target', 'trend']),
      price: z.number().finite(),
      endPrice: z.number().finite().optional(),
      startCursor: z.number().int().min(0).optional(),
      endCursor: z.number().int().min(0).optional(),
      text: z.string().max(200).default(''),
      version,
    })
    .strict(),
]);
function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ReplayError(
      'REPLAY_INVALID_INPUT',
      result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
      400
    );
  return result.data;
}
const runId = (id) => {
  if (!/^[a-f\d]{24}$/i.test(id))
    throw new ReplayError('REPLAY_NOT_FOUND', 'Replay run not found.', 404);
  return id;
};

export function createReplayService({
  market = marketDataService,
  Run = ReplayRun,
  Trades = Trade,
  Strategies = Strategy,
} = {}) {
  const owned = async (userId, id) => {
    const run = await Run.findOne({ _id: runId(id), userId })
      .select('+historicalTrades')
      .lean();
    if (!run)
      throw new ReplayError('REPLAY_NOT_FOUND', 'Replay run not found.', 404);
    return run;
  };
  const load = async (userId, run) => {
    const result = await market.getCandles({ ...run.marketRequest, userId });
    if (
      result.state !== 'available' ||
      result.dataset.revision !== run.sourceRevision ||
      result.candles.length !== run.barCount
    )
      throw new ReplayError(
        'REPLAY_SOURCE_CHANGED',
        'Historical data is missing or has changed. Start a new run; saved decisions remain intact.',
        409
      );
    return result.candles;
  };
  const commit = async (userId, run, expectedVersion, update) => {
    if (run.version !== expectedVersion)
      throw new ReplayError(
        'REPLAY_CONFLICT',
        'This run changed. Reload it before continuing.',
        409
      );
    const changed = await Run.findOneAndUpdate(
      { _id: run._id, userId, version: expectedVersion },
      { ...update, $inc: { version: 1 } },
      { new: true, runValidators: true }
    )
      .select('+historicalTrades')
      .lean();
    if (!changed)
      throw new ReplayError(
        'REPLAY_CONFLICT',
        'This run changed. Reload it before continuing.',
        409
      );
    return changed;
  };
  const service = {
    async datasets(userId) {
      return market.listDatasets(userId);
    },
    async list(userId) {
      return Run.find({ userId })
        .select('_id name mode cursor barCount version updatedAt')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();
    },
    async create(userId, input) {
      const { name, mode, ...query } = parse(createSchema, input);
      const data = await market.getCandles({ ...query, userId });
      if (data.state !== 'available')
        throw new ReplayError(
          'REPLAY_INCOMPLETE_DATA',
          `Cannot replay ${data.state} data. Select a complete historical range.`
        );
      if (data.candles.length > 5000)
        throw new ReplayError(
          'REPLAY_LIMIT',
          'Select at most 5,000 bars per replay.',
          413
        );
      // Entire source candles are required to close within the requested interval.
      const candles = data.candles.filter(
        (bar) => bar.endTimestamp <= data.request.to
      );
      if (!candles.length || candles.length !== data.candles.length)
        throw new ReplayError(
          'REPLAY_PARTIAL_BAR',
          'The range must end at or after the final candle closes.'
        );
      const trades = await Trades.find({
        userId,
        symbol: data.request.symbol,
        entryTime: { $lt: new Date(data.request.to) },
        $or: [
          { exitTime: null },
          { exitTime: { $gte: new Date(data.request.from) } },
        ],
      })
        .sort({ entryTime: 1 })
        .limit(201)
        .lean();
      if (
        trades.length > 200 ||
        trades.reduce((n, trade) => n + (trade.executions || []).length, 0) >
          5000
      )
        throw new ReplayError(
          'REPLAY_LIMIT',
          'Narrow the range to at most 200 trades and 5,000 executions.',
          413
        );
      const strategies = await Strategies.find({
        userId,
        _id: { $in: trades.map((trade) => trade.strategy).filter(Boolean) },
      })
        .select('_id name')
        .lean();
      const names = new Map(
        strategies.map((strategy) => [String(strategy._id), strategy.name])
      );
      const historicalTrades = trades.map((trade) => ({
        id: String(trade._id),
        direction: trade.direction,
        quantity: trade.quantity,
        entryTime: trade.entryTime,
        exitTime: trade.exitTime,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        executions: (trade.executions || []).map(
          ({ side, time, price, quantity }) => ({
            side,
            time,
            price,
            quantity,
          })
        ),
        netPnL: trade.netPnL,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        setup: trade.setup,
        strategy: names.get(String(trade.strategy)) || '',
        notes: String(trade.notes || '').slice(0, 2000),
      }));
      const saved = await Run.create({
        userId,
        name,
        mode,
        marketRequest: { ...data.request, datasetId: query.datasetId },
        sourceRevision: data.dataset.revision,
        dataset: data.dataset,
        barCount: candles.length,
        historicalTrades,
      });
      return projectReplay(saved.toObject(), candles);
    },
    async get(userId, id) {
      const run = await owned(userId, id);
      return projectReplay(run, await load(userId, run));
    },
    async control(userId, id, input) {
      const command = parse(controlSchema, input);
      const run = await owned(userId, id);
      const candles = await load(userId, run);
      const changed = await commit(userId, run, command.version, {
        $set: transition(run, command),
      });
      return projectReplay(changed, candles);
    },
    async addEvent(userId, id, input) {
      const { version: expectedVersion, ...event } = parse(eventSchema, input);
      const run = await owned(userId, id);
      const candles = await load(userId, run);
      if (run.events.length >= 500)
        throw new ReplayError(
          'REPLAY_LIMIT',
          'This run has reached its 500 annotation/decision limit.',
          413
        );
      if (
        event.kind === 'line' &&
        (run.cursor < 0 ||
          (event.lineType === 'trend' &&
            (event.startCursor === undefined ||
              event.startCursor > run.cursor ||
              event.endCursor === undefined ||
              event.endCursor > run.cursor ||
              event.endPrice === undefined)))
      )
        throw new ReplayError(
          'REPLAY_INVALID_DRAWING',
          'Draw only between already revealed bars.',
          400
        );
      const saved = {
        ...event,
        cursor: run.cursor,
        timestamp: replayTime(run, candles),
        afterExposure: run.revealed || run.cursor < run.maxCursor,
      };
      const changed = await commit(userId, run, expectedVersion, {
        $push: { events: saved },
      });
      return projectReplay(changed, candles);
    },
    async removeEvent(userId, id, eventId, input) {
      const parsed = parse(z.object({ version }).strict(), input);
      const run = await owned(userId, id);
      const event = run.events.find(
        (item) => String(item._id) === eventId && item.cursor <= run.cursor
      );
      if (!event || event.kind === 'decision')
        throw new ReplayError(
          'REPLAY_EVENT_LOCKED',
          'Training decisions are immutable; only visible notes/drawings can be removed.',
          409
        );
      const candles = await load(userId, run);
      return projectReplay(
        await commit(userId, run, parsed.version, {
          $pull: { events: { _id: event._id } },
        }),
        candles
      );
    },
    async screenshot(userId, id, input, file) {
      const parsed = parse(
        z
          .object({
            version: z.coerce.number().int().min(0),
            caption: z.string().max(200).default(''),
          })
          .strict(),
        input
      );
      const run = await owned(userId, id);
      const candles = await load(userId, run);
      if (run.cursor < 0 || run.screenshots.length >= 10)
        throw new ReplayError(
          'REPLAY_LIMIT',
          'Reveal a bar first; up to ten screenshots may be saved.',
          413
        );
      if (
        !file ||
        file.mimetype !== 'image/png' ||
        file.buffer.length < 24 ||
        file.buffer.length > 1024 * 1024 ||
        file.buffer.toString('ascii', 12, 16) !== 'IHDR' ||
        file.buffer.readUInt32BE(16) < 1 ||
        file.buffer.readUInt32BE(16) > 4096 ||
        file.buffer.readUInt32BE(20) < 1 ||
        file.buffer.readUInt32BE(20) > 4096 ||
        !file.buffer
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw new ReplayError(
          'REPLAY_INVALID_IMAGE',
          'A PNG chart screenshot is required.',
          400
        );
      const shot = {
        id: crypto.randomUUID(),
        cursor: run.cursor,
        timestamp: replayTime(run, candles),
        caption: parsed.caption,
      };
      const dir = path.join(
        uploadsRootPath,
        'replay',
        String(userId),
        String(run._id)
      );
      await mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${shot.id}.png`);
      await writeFile(filePath, file.buffer, { flag: 'wx' });
      try {
        return projectReplay(
          await commit(userId, run, parsed.version, {
            $push: { screenshots: shot },
          }),
          candles
        );
      } catch (error) {
        await unlink(filePath).catch(() => {});
        throw error;
      }
    },
    async screenshotPath(userId, id, shotId) {
      const run = await owned(userId, id);
      if (
        !/^[a-f\d-]{36}$/.test(shotId) ||
        !run.screenshots.some(
          (shot) => shot.id === shotId && shot.cursor <= run.cursor
        )
      )
        throw new ReplayError(
          'REPLAY_NOT_FOUND',
          'Visible screenshot not found.',
          404
        );
      return path.join(
        uploadsRootPath,
        'replay',
        String(userId),
        String(run._id),
        `${shotId}.png`
      );
    },
  };
  return service;
}
export default createReplayService();
