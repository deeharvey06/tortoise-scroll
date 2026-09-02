import * as tradeService from '../services/tradeService.js';

export async function getTrades(req, res) {
  const result = await tradeService.listTrades(req.user.id, req.query);
  res.json(result);
}

export async function getTrade(req, res) {
  const trade = await tradeService.getTradeById(req.params.id, req.user.id);
  if (!trade) {
    res.status(404);
    throw new Error(`Trade ${req.params.id} not found`);
  }
  res.json(trade);
}

export async function postTrade(req, res) {
  const trade = await tradeService.createTrade(req.body, req.user.id);
  res.status(201).json(trade);
}

export async function putTrade(req, res) {
  const trade = await tradeService.updateTrade(req.params.id, req.body, req.user.id);
  if (!trade) {
    res.status(404);
    throw new Error(`Trade ${req.params.id} not found`);
  }
  res.json(trade);
}

export async function deleteTradeHandler(req, res) {
  const deleted = await tradeService.deleteTrade(req.params.id, req.user.id);
  if (!deleted) {
    res.status(404);
    throw new Error(`Trade ${req.params.id} not found`);
  }
  res.status(204).send();
}

export async function bulkDeleteHandler(req, res) {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error('ids must be a non-empty array');
  }
  const result = await tradeService.bulkDeleteTrades(ids, req.user.id);
  res.json({ deletedCount: result.deletedCount });
}

export async function bulkTagHandler(req, res) {
  const { ids, tags } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !Array.isArray(tags) || tags.length === 0) {
    res.status(400);
    throw new Error('ids and tags must be non-empty arrays');
  }
  const result = await tradeService.bulkTagTrades(ids, tags, req.user.id);
  res.json({ modifiedCount: result.modifiedCount });
}

const CSV_COLUMNS = [
  'entryTime', 'exitTime', 'symbol', 'direction', 'quantity', 'entryPrice', 'exitPrice',
  'grossPnL', 'netPnL', 'rMultiple', 'setup', 'session', 'tags', 'followedPlan', 'notes',
];

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportTradesCsv(req, res) {
  const trades = await tradeService.exportTrades(req.query, req.user.id);
  const lines = [CSV_COLUMNS.join(',')];
  for (const t of trades) {
    const row = CSV_COLUMNS.map((col) => {
      if (col === 'tags') return csvEscape((t.tags || []).join('|'));
      return csvEscape(t[col]);
    });
    lines.push(row.join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="trades-export.csv"`);
  res.send(lines.join('\n'));
}

export default {
  getTrades,
  getTrade,
  postTrade,
  putTrade,
  deleteTradeHandler,
  bulkDeleteHandler,
  bulkTagHandler,
  exportTradesCsv,
};
