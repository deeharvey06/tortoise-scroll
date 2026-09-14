import BrokerConnection from '../models/BrokerConnection.js';
import { syncBrokerConnection } from './brokerSyncService.js';

let timer = null;
let running = false;
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
  if (!enabled || timer) return;
  const tickMs = Number(process.env.BROKER_SYNC_SCHEDULER_TICK_MS || 60000);
  const tick = async () => {
    await runDueBrokerSyncs();
    timer = setTimeout(tick, tickMs);
    timer.unref?.();
  };
  timer = setTimeout(tick, Math.min(5000, tickMs));
  timer.unref?.();
}
export function stopBrokerSyncScheduler() {
  if (timer) clearTimeout(timer);
  timer = null;
}
