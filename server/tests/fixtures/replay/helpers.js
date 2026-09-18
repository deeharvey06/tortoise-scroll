import mongoose from 'mongoose';
import ReplayRun from '../../../src/models/ReplayRun.js';
import { createReplayService } from '../../../src/services/replay/replayService.js';
import { createMarketDataService } from '../../../src/services/marketDataService.js';
import { fixture, requestRange } from '../market-data/helpers.js';
export { OWNER, OTHER } from '../market-data/helpers.js';
export const createInput = {
  name: 'Test replay',
  mode: 'blind',
  datasetId: 'aapl-minute',
  symbol: 'AAPL',
  timeframe: '1m',
  from: requestRange.from,
  to: requestRange.to,
};
export async function setupReplay(t, trades = []) {
  const local = await fixture(t);
  const records = new Map();
  const query = (value) => ({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    lean: async () => structuredClone(value),
  });
  const matches = (run, filter) =>
    run &&
    String(run.userId) === String(filter.userId) &&
    (filter.version === undefined || run.version === filter.version);
  const plain = (input) =>
    JSON.parse(JSON.stringify(new ReplayRun(input).toObject()));
  const Run = {
    create: async (input) => {
      const saved = plain(input);
      records.set(saved._id, saved);
      return { toObject: () => structuredClone(saved) };
    },
    find: ({ userId }) =>
      query(
        [...records.values()]
          .filter((run) => run.userId === userId)
          .map(({ _id, name, mode, cursor, barCount, version }) => ({
            _id,
            name,
            mode,
            cursor,
            barCount,
            version,
          }))
      ),
    findOne: (filter) =>
      query(
        matches(records.get(String(filter._id)), filter)
          ? records.get(String(filter._id))
          : null
      ),
    findOneAndUpdate: (filter, update) => {
      const run = records.get(String(filter._id));
      if (!matches(run, filter)) return query(null);
      Object.assign(run, update.$set);
      for (const [key, value] of Object.entries(update.$push || {}))
        run[key].push({
          ...value,
          ...(key === 'events'
            ? { _id: String(new mongoose.Types.ObjectId()) }
            : {}),
        });
      if (update.$pull?.events)
        run.events = run.events.filter(
          (event) => event._id !== String(update.$pull.events._id)
        );
      run.version += update.$inc.version;
      const saved = plain(run);
      records.set(saved._id, saved);
      return query(saved);
    },
  };
  const captured = [];
  const Trades = {
    find: (filter) => {
      captured.push(filter);
      return query(trades);
    },
  };
  const Strategies = { find: () => query([]) };
  const market = createMarketDataService({ provider: local.provider });
  return {
    ...local,
    records,
    Run,
    captured,
    market,
    service: createReplayService({ Run, Trades, Strategies, market }),
  };
}
