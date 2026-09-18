import { open, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import csv from 'csv-parser';
import { z } from 'zod';
import { MarketDataProvider } from './MarketDataProvider.js';
import { normalizeCalendar } from './calendar.js';
import {
  TIMEFRAMES,
  SESSION_KINDS,
  MAX_BARS,
  validateTimezone,
} from './time.js';
import { fail, MarketDataError } from './errors.js';

const MAX_FILE_BYTES = 16 * 1024 * 1024;
const calendarSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    timestampFormat: z.enum(['offset', 'local']),
    sessions: z
      .array(
        z
          .object({
            tradingDate: z.string(),
            kind: z.enum(SESSION_KINDS),
            start: z.string(),
            end: z.string(),
          })
          .strict()
      )
      .max(10_000),
  })
  .strict();
const manifestSchema = z
  .object({
    version: z.literal(1),
    datasets: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
            symbol: z.string(),
            timeframe: z.enum(Object.keys(TIMEFRAMES)),
            assetType: z.enum([
              'equity',
              'future',
              'option',
              'forex',
              'crypto',
            ]),
            file: z.string().min(1).max(255),
            timezone: z.string(),
            timestampFormat: z.enum(['offset', 'local']),
            timestampConvention: z.literal('start'),
            priceBasis: z.enum(['unadjusted', 'adjusted']),
            calendar: calendarSchema,
          })
          .strict()
      )
      .max(100),
  })
  .strict();
const signature = (info) =>
  [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs]
    .map(String)
    .join(':');

// Files are selected exclusively by a server-managed manifest in the trusted
// user's directory. Realpath containment prevents symlink and traversal escapes.
async function resolveFile(base, relative, limit) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..'))
    fail(
      'MARKET_DATA_INVALID_SOURCE',
      'Dataset source must stay within its owner directory.'
    );
  const resolved = await realpath(path.resolve(base, relative));
  if (!resolved.startsWith(`${base}${path.sep}`))
    fail(
      'MARKET_DATA_INVALID_SOURCE',
      'Dataset source must stay within its owner directory.'
    );
  const info = await stat(resolved, { bigint: true });
  if (!info.isFile())
    fail(
      'MARKET_DATA_INVALID_SOURCE',
      'Dataset source must be a regular file.'
    );
  if (info.size > BigInt(limit))
    fail(
      'MARKET_DATA_LIMIT_EXCEEDED',
      'Market-data file exceeds its size limit.',
      413
    );
  return { path: resolved, revision: signature(info), limit };
}

async function readStable(source) {
  const file = await open(source.path, 'r');
  try {
    const before = await file.stat({ bigint: true });
    if (signature(before) !== source.revision)
      fail(
        'MARKET_DATA_SOURCE_CHANGED',
        'Historical data changed during loading; retry.',
        409
      );
    // Read through a bounded stream even if the source grows after stat().
    const chunks = [];
    let bytes = 0;
    for await (const chunk of file.createReadStream({ autoClose: false })) {
      bytes += chunk.length;
      if (bytes > source.limit)
        fail(
          'MARKET_DATA_LIMIT_EXCEEDED',
          'Market-data file exceeds its size limit.',
          413
        );
      chunks.push(chunk);
    }
    if (signature(await file.stat({ bigint: true })) !== source.revision)
      fail(
        'MARKET_DATA_SOURCE_CHANGED',
        'Historical data changed during loading; retry.',
        409
      );
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await file.close();
  }
}

export class LocalCsvProvider extends MarketDataProvider {
  constructor({ root, ...options }) {
    super('local-csv', options);
    this.root = path.resolve(root);
  }
  async catalog(userId) {
    if (typeof userId !== 'string' || !/^[a-f0-9]{24}$/.test(userId))
      fail(
        'MARKET_DATA_OWNER_REQUIRED',
        'An authenticated owner is required.',
        401
      );
    const root = await realpath(this.root);
    const base = path.join(root, userId);
    let manifest;
    try {
      if ((await realpath(base)) !== base)
        fail(
          'MARKET_DATA_INVALID_SOURCE',
          'Owner directories must not be symbolic links.'
        );
      manifest = await resolveFile(base, 'manifest.json', 1024 * 1024);
    } catch (error) {
      if (error.code === 'ENOENT') return { base, datasets: [] };
      throw error;
    }
    let parsed;
    try {
      parsed = manifestSchema.parse(JSON.parse(await readStable(manifest)));
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      fail(
        'MARKET_DATA_INVALID_MANIFEST',
        'The local dataset manifest is invalid.'
      );
    }
    const ids = new Set();
    const datasets = parsed.datasets.map((item) => {
      if (ids.has(item.id))
        fail(
          'MARKET_DATA_INVALID_MANIFEST',
          'Dataset IDs must be unique within an owner catalog.'
        );
      ids.add(item.id);
      return {
        ...item,
        symbol: this.normalizeSymbol(item.symbol),
        timezone: validateTimezone(item.timezone),
        calendar: normalizeCalendar(item.calendar, item.timezone),
      };
    });
    return { base, datasets };
  }
  async listDatasets(userId) {
    const { datasets } = await this.catalog(userId);
    return datasets.map(({ file: _file, ...item }) => item);
  }
  async describe({ userId, datasetId, symbol, timeframe }) {
    const { base, datasets } = await this.catalog(userId);
    const candidates = datasets.filter(
      (item) =>
        (!datasetId || item.id === datasetId) &&
        item.symbol === symbol &&
        item.timeframe === timeframe
    );
    if (!candidates.length)
      fail(
        'MARKET_DATA_UNAVAILABLE',
        'No owned dataset supports the requested symbol and timeframe.',
        404
      );
    if (candidates.length > 1)
      fail(
        'MARKET_DATA_AMBIGUOUS_DATASET',
        'Select a datasetId: multiple datasets match this symbol and timeframe.',
        400
      );
    const { file, ...dataset } = candidates[0];
    const source = await resolveFile(base, file, MAX_FILE_BYTES);
    const revision = crypto
      .createHash('sha256')
      .update(JSON.stringify(dataset))
      .update(source.path)
      .update(source.revision)
      .digest('hex');
    return { dataset, source, revision };
  }
  async fetchCandles({ source }) {
    const text = await readStable(source);
    const rows = [];
    const parser = csv({
      strict: true,
      maxRowBytes: 8192,
      mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
    });
    let validHeaders = false;
    parser.on('headers', (headers) => {
      const required = ['timestamp', 'open', 'high', 'low', 'close'];
      validHeaders =
        required.every((key) => headers.includes(key)) &&
        new Set(headers).size === headers.length &&
        headers.every((key) => [...required, 'volume'].includes(key));
      if (!validHeaders)
        parser.destroy(
          new MarketDataError(
            'MARKET_DATA_INVALID_CSV',
            'CSV requires timestamp,open,high,low,close and optional volume columns.'
          )
        );
    });
    try {
      for await (const row of Readable.from([text]).pipe(parser)) {
        if (rows.length >= MAX_BARS)
          fail(
            'MARKET_DATA_LIMIT_EXCEEDED',
            'CSV exceeds the supported row limit.',
            413
          );
        rows.push(row);
      }
      if (!validHeaders)
        fail('MARKET_DATA_INVALID_CSV', 'CSV headers are missing.');
      return rows;
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      fail('MARKET_DATA_INVALID_CSV', 'CSV contains malformed rows.');
    }
  }
}
