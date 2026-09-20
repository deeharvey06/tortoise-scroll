import logger from '../config/logger.js';
import BrokerConnection from '../models/BrokerConnection.js';
import { syncBrokerConnection } from './brokerSyncService.js';

let timer = null;
let running = false;
let stopped = true;

export async function runDueBrokerSyncs() {
  if (running) return;
  running = true;

  try {
    const due = await BrokerConnection.find({
      status: { $in: ['connected', 'provider_unavailable', 'rate_limited'] },
      nextSyncAt: { $lte: new Date() },
    })
      .select('_id userId')
      .lean();

    for (const item of due) {
      try {
        await syncBrokerConnection({
          userId: item.userId,
          connectionId: item._id,
          syncType: 'incremental',
        });
      } catch {
        /* failure is persisted on the connection/run */
      }
    }
  } finally {
    running = false;
  }
}

export function startBrokerSyncScheduler() {
  const enabled = process.env.BROKER_SYNC_SCHEDULER_ENABLED
    ? process.env.BROKER_SYNC_SCHEDULER_ENABLED === 'true'
    : process.env.NODE_ENV !== 'test';

  if (!enabled || !stopped) return;
  stopped = false;

  const tickMs = Number(process.env.BROKER_SYNC_SCHEDULER_TICK_MS || 60000);
  const tick = async () => {
    try {
      await runDueBrokerSyncs();
    } catch {
      logger.error({
        event: 'BROKER_SCHEDULER_FAILED',
        component: 'scheduler',
        outcome: 'failure',
      });
    }

    if (stopped) return;
    timer = setTimeout(tick, tickMs);
    timer.unref?.();
  };

  timer = setTimeout(tick, Math.min(5000, tickMs));
  timer.unref?.();
}

export async function stopBrokerSyncScheduler() {
  stopped = true;
  if (timer) clearTimeout(timer);

  timer = null;
  while (running) await new Promise((resolve) => setTimeout(resolve, 25));
}
