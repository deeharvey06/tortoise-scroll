import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Account from '../src/models/Account.js';
import Trade from '../src/models/Trade.js';
import Strategy from '../src/models/Strategy.js';
import Tag from '../src/models/Tag.js';
import JournalEntry from '../src/models/JournalEntry.js';
import { computeTradeFinancials } from '../src/services/calculationsService.js';
import User, { normalizeEmail } from '../src/models/User.js';

/**
 * Generates realistic-looking DEMO data so a new install has something to
 * explore immediately. Every trade this script creates is flagged
 * isDemoData: true, and every account/strategy/tag/journal entry it creates
 * is prefixed "[DEMO]" so it's unmistakable in the UI and easy to remove
 * later (see the cleanup note printed at the end).
 *
 * Safe to re-run: it deletes only its own previously-seeded [DEMO] data
 * before generating fresh data, never touching real trades you've logged.
 */

const TRADE_COUNT = Number(process.env.SEED_TRADE_COUNT) || 1000;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function pickSome(arr, min, max) {
  const n = randInt(min, max);
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function pickWeighted(winProbability) {
  return Math.random() < winProbability;
}

const SYMBOLS = [
  { symbol: 'AAPL', base: 190 }, { symbol: 'MSFT', base: 420 }, { symbol: 'TSLA', base: 250 },
  { symbol: 'NVDA', base: 130 }, { symbol: 'AMZN', base: 185 }, { symbol: 'GOOGL', base: 175 },
  { symbol: 'META', base: 500 }, { symbol: 'AMD', base: 165 }, { symbol: 'SPY', base: 560 },
  { symbol: 'QQQ', base: 480 }, { symbol: 'NFLX', base: 680 }, { symbol: 'JPM', base: 210 },
  { symbol: 'BA', base: 180 }, { symbol: 'DIS', base: 100 }, { symbol: 'COIN', base: 220 },
];

const SETUPS = [
  'Breakout', 'Reversal', 'Trend Continuation', 'Pullback', 'Trading Range', 'Gap Fill', 'VWAP Bounce',
  'Bull Flag', 'Bear Flag', 'Double Top', 'Double Bottom', 'Range Break', 'News Spike', 'EOD Fade',
  'Opening Drive', 'Mean Reversion', 'Momentum Continuation', 'Failed Breakout', 'Support Bounce',
  'Resistance Reject',
];

const SESSIONS = ['pre-market', 'open', 'mid-day', 'power-hour', 'after-hours'];

const MISTAKE_OPTIONS = ['Early Entry', 'Late Entry', 'Overtrading', 'FOMO', 'Oversized', 'Poor Exit', 'Failed Follow-through'];
const EMOTION_OPTIONS = ['Calm', 'Confident', 'Fear', 'Frustrated', 'Revenge', 'FOMO'];

const STRATEGY_DEFS = [
  { name: '[DEMO] ORB Breakout', timeframe: '5m', market: 'Equities' },
  { name: '[DEMO] VWAP Reversion', timeframe: '1m', market: 'Equities' },
  { name: '[DEMO] Gap and Go', timeframe: '1m', market: 'Equities' },
  { name: '[DEMO] Bull Flag Continuation', timeframe: '5m', market: 'Equities' },
  { name: '[DEMO] EOD Fade', timeframe: '15m', market: 'Equities' },
  { name: '[DEMO] News Momentum', timeframe: '1m', market: 'Equities' },
  { name: '[DEMO] Range Scalp', timeframe: '1m', market: 'Equities' },
  { name: '[DEMO] Trend Pullback', timeframe: '1h', market: 'Equities' },
  { name: '[DEMO] Double Bottom Reversal', timeframe: '5m', market: 'Equities' },
  { name: '[DEMO] Power Hour Momentum', timeframe: '5m', market: 'Equities' },
];

function randomDateWithinLastNDays(days) {
  const now = Date.now();
  const past = now - days * 24 * 60 * 60 * 1000;
  return new Date(rand(past, now));
}

function buildRandomTrade({ accountId, strategyIds }) {
  const { symbol, base } = pick(SYMBOLS);
  const direction = Math.random() < 0.55 ? 'long' : 'short';
  const quantity = pick([25, 50, 75, 100, 150, 200]);

  const entryTime = randomDateWithinLastNDays(180);
  // Sessions cluster around market hours in spirit, not literal UTC offsets
  // (this is demo data, not a claim about real market hours).
  const holdingMinutes = randInt(3, 180);
  const exitTime = new Date(entryTime.getTime() + holdingMinutes * 60 * 1000);

  const entryPrice = Number((base * rand(0.97, 1.03)).toFixed(2));
  const isWin = pickWeighted(0.52); // slightly-better-than-coinflip demo trader
  const movePct = isWin ? rand(0.003, 0.025) : -rand(0.002, 0.02);
  const exitPrice = Number((entryPrice * (1 + (direction === 'long' ? movePct : -movePct))).toFixed(2));

  const stopDistancePct = rand(0.005, 0.015);
  const stopLoss = Number(
    (direction === 'long' ? entryPrice * (1 - stopDistancePct) : entryPrice * (1 + stopDistancePct)).toFixed(2)
  );
  const riskAmount = Number((Math.abs(entryPrice - stopLoss) * quantity).toFixed(2));

  const fees = Number(rand(0, 1).toFixed(2));
  const commission = Number(rand(0, 4).toFixed(2));

  const setup = pick(SETUPS);
  const session = pick(SESSIONS);
  const followedPlan = Math.random() < 0.8;
  const mistakes = !followedPlan || Math.random() < 0.15 ? pickSome(MISTAKE_OPTIONS, 1, 2) : [];
  const emotions = Math.random() < 0.4 ? pickSome(EMOTION_OPTIONS, 1, 1) : [];

  const computed = computeTradeFinancials({
    direction,
    quantity,
    entryPrice,
    exitPrice,
    entryTime,
    exitTime,
    stopLoss,
    riskAmount,
    fees,
    commission,
  });

  return {
    accountId,
    strategy: Math.random() < 0.7 ? pick(strategyIds) : null,
    symbol,
    assetType: 'equity',
    direction,
    stopLoss,
    riskAmount,
    setup,
    session,
    followedPlan,
    mistake: mistakes,
    emotion: emotions,
    tags: [],
    notes: '',
    isDemoData: true,
    ...computed,
  };
}

const JOURNAL_TYPES = ['pre-market', 'daily', 'post-market', 'weekly', 'monthly', 'freeform'];

function buildJournalEntry() {
  const type = pick(JOURNAL_TYPES);
  const date = randomDateWithinLastNDays(180);
  const contentByType = {
    'pre-market': 'Market:\nMixed futures.\n\nBias:\nCautiously bullish.\n\nRisk Limit:\n$300\n\nMaximum Trades:\n5',
    daily: 'Traded 3 setups today, mixed results. Stayed disciplined on sizing.',
    'post-market': 'What went well?\nFollowed my plan on 2 of 3 trades.\n\nWhat went poorly?\nChased one entry late.\n\nWhat will I change tomorrow?\nWait for confirmation candle.',
    weekly: 'Weekly review: net positive week, biggest edge was morning breakouts.',
    monthly: 'Monthly review: consistency improving, need to cut down on afternoon overtrading.',
    freeform: 'Note to self: revisit position sizing rules for high-volatility names.',
  };
  return {
    type,
    date,
    title: '[DEMO] ' + type.replace('-', ' '),
    content: '[DEMO ENTRY] ' + contentByType[type],
  };
}

async function seed() {
  console.log('[seed] Connecting to MongoDB...');
  await connectDB();
  const root = await User.findOne({ role: 'ROOT', emailNormalized: normalizeEmail(process.env.ROOT_USER_EMAIL), status: 'ACTIVE' });
  if (!root) throw new Error('Configured active ROOT account is required before seeding');
  const userId = root._id;

  console.log('[seed] Clearing previously seeded [DEMO] data (real data is untouched)...');
  await Trade.deleteMany({ userId, isDemoData: true });
  await Account.deleteMany({ userId, name: /^\[DEMO\]/ });
  await Strategy.deleteMany({ userId, name: /^\[DEMO\]/ });
  await Tag.deleteMany({ userId, name: /^\[DEMO\]/ });
  await JournalEntry.deleteMany({ userId, title: /^\[DEMO\]/ });

  console.log('[seed] Creating 3 demo accounts...');
  const accounts = await Account.insertMany([
    { userId, name: '[DEMO] Main Account', broker: 'Demo Broker', currency: 'USD', startingBalance: 25000 },
    { userId, name: '[DEMO] Swing Account', broker: 'Demo Broker', currency: 'USD', startingBalance: 50000 },
    { userId, name: '[DEMO] Small Account', broker: 'Demo Broker', currency: 'USD', startingBalance: 5000 },
  ]);

  console.log('[seed] Creating 10 demo strategies...');
  const strategies = await Strategy.insertMany(
    STRATEGY_DEFS.map((s) => ({
      ...s,
      userId,
      description: `[DEMO] Sample strategy definition for ${s.name.replace('[DEMO] ', '')}.`,
      entryRules: 'Enter on confirmation of setup with volume above average.',
      exitRules: 'Exit at target or on opposite signal.',
      stopRules: 'Stop below/above the setup invalidation level.',
      targetRules: 'Target 2R minimum, trail on strength.',
      riskRules: 'Risk no more than 1% of account per trade.',
    }))
  );

  console.log('[seed] Creating 30 demo tags...');
  const demoTagNames = [
    ...SETUPS.slice(0, 10).map((s) => ({ userId, name: `[DEMO] ${s}`, category: 'Setup' })),
    ...MISTAKE_OPTIONS.map((m) => ({ userId, name: `[DEMO] ${m}`, category: 'Mistake' })),
    ...EMOTION_OPTIONS.map((e) => ({ userId, name: `[DEMO] ${e}`, category: 'Emotion' })),
    ...Array.from({ length: 30 - 10 - MISTAKE_OPTIONS.length - EMOTION_OPTIONS.length }, (_, i) => ({
      name: `[DEMO] Custom Tag ${i + 1}`,
      userId, category: 'Custom',
    })),
  ];
  await Tag.insertMany(demoTagNames);

  console.log(`[seed] Generating ${TRADE_COUNT} demo trades (this reuses the real calculationsService, so all P&L/R figures are computed exactly as they would be for a real trade)...`);
  const accountIds = accounts.map((a) => a._id);
  const strategyIds = strategies.map((s) => s._id);
  const tradeDocs = [];
  for (let i = 0; i < TRADE_COUNT; i += 1) {
    tradeDocs.push({ ...buildRandomTrade({ accountId: pick(accountIds), strategyIds }), userId });
  }
  // insertMany in batches to avoid one giant payload
  const BATCH_SIZE = 200;
  for (let i = 0; i < tradeDocs.length; i += BATCH_SIZE) {
    await Trade.insertMany(tradeDocs.slice(i, i + BATCH_SIZE));
    console.log(`[seed]   ...${Math.min(i + BATCH_SIZE, tradeDocs.length)} / ${tradeDocs.length}`);
  }

  console.log('[seed] Creating 60 demo journal entries...');
  const journalDocs = Array.from({ length: 60 }, () => ({ ...buildJournalEntry(), userId }));
  await JournalEntry.insertMany(journalDocs);

  console.log('\n[seed] Done. Summary:');
  console.log(`  Accounts:  ${accounts.length}`);
  console.log(`  Strategies: ${strategies.length}`);
  console.log(`  Tags:      ${demoTagNames.length}`);
  console.log(`  Trades:    ${tradeDocs.length} (all isDemoData: true)`);
  console.log(`  Journal:   ${journalDocs.length}`);
  console.log(
    '\nAll seeded data is prefixed "[DEMO]" (accounts/strategies/tags/journal) or flagged isDemoData:true ' +
      '(trades). This is generated data for exploring the app, not real market history — see spec section 31. ' +
      'To remove it later: re-run `npm run seed` (it clears old demo data first) or delete manually by the ' +
      '"[DEMO]" name prefix / isDemoData:true flag.'
  );

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
