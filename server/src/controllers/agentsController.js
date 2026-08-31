import TaggingRule from '../models/TaggingRule.js';
import * as autoTaggerAgent from '../agents/autoTaggerAgent.js';
import * as sessionReviewAgent from '../agents/sessionReviewAgent.js';
import * as preMarketAgent from '../agents/preMarketAgent.js';
import * as riskAgent from '../agents/riskAgent.js';
import * as performanceAgent from '../agents/performanceAgent.js';

function extractFilters(req) {
  const { accountId, symbol, strategy, playbook, setup, direction, session, tags, dateFrom, dateTo } = req.query;
  return { accountId, symbol, strategy, playbook, setup, direction, session, tags, dateFrom, dateTo };
}

// --- Tagging rules (Agent 1 config) ---

export async function listTaggingRules(req, res) {
  const rules = await TaggingRule.find().sort({ createdAt: -1 }).lean();
  res.json(rules);
}

export async function createTaggingRule(req, res) {
  const rule = await TaggingRule.create(req.body);
  res.status(201).json(rule);
}

export async function updateTaggingRule(req, res) {
  const rule = await TaggingRule.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!rule) {
    res.status(404);
    throw new Error('Tagging rule not found');
  }
  res.json(rule);
}

export async function deleteTaggingRule(req, res) {
  const deleted = await TaggingRule.findByIdAndDelete(req.params.id);
  if (!deleted) {
    res.status(404);
    throw new Error('Tagging rule not found');
  }
  res.status(204).send();
}

export async function runAutoTagger(req, res) {
  const { tradeIds } = req.body;
  if (!Array.isArray(tradeIds) || tradeIds.length === 0) {
    res.status(400);
    throw new Error('tradeIds must be a non-empty array');
  }
  const result = await autoTaggerAgent.runAutoTagger(tradeIds);
  res.json(result);
}

export async function approveSuggestion(req, res) {
  const { tradeId, tags } = req.body;
  if (!tradeId || !Array.isArray(tags) || tags.length === 0) {
    res.status(400);
    throw new Error('tradeId and a non-empty tags array are required');
  }
  const trade = await autoTaggerAgent.approveSuggestion(tradeId, tags);
  res.json(trade);
}

// --- Agent 2: Session Review ---

export async function getSessionReview(req, res) {
  const { date } = req.query;
  if (!date) {
    res.status(400);
    throw new Error('date query param (YYYY-MM-DD) is required');
  }
  const review = await sessionReviewAgent.generateSessionReview(date, extractFilters(req));
  res.json(review);
}

// --- Agent 3: Pre-Market Briefing ---

export async function getPreMarketBriefing(req, res) {
  const briefing = await preMarketAgent.generatePreMarketBriefing(extractFilters(req));
  res.json(briefing);
}

// --- Agent 4: Risk Monitor ---

export async function getRiskAlert(req, res) {
  const { accountId } = req.query;
  const alert = await riskAgent.generateRiskAlert(accountId || null);
  res.json(alert);
}

// --- Agent 5: Performance Patterns ---

export async function getPerformancePatterns(req, res) {
  const patterns = await performanceAgent.generatePerformancePatterns(extractFilters(req));
  res.json(patterns);
}

export default {
  listTaggingRules,
  createTaggingRule,
  updateTaggingRule,
  deleteTaggingRule,
  runAutoTagger,
  approveSuggestion,
  getSessionReview,
  getPreMarketBriefing,
  getRiskAlert,
  getPerformancePatterns,
};
