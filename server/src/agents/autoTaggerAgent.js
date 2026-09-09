import TaggingRule from '../models/TaggingRule.js';
import * as tradeService from '../services/tradeService.js';

/**
 * Evaluates a single condition against a trade. Deliberately simple and
 * deterministic — this is rule matching, not inference, so there is no AI
 * involvement anywhere in this file.
 */
export function evaluateCondition(trade, condition) {
  const { field, operator, value } = condition;
  const actual = trade[field];

  if (actual === null || actual === undefined) return false;

  switch (operator) {
    case 'equals':
      return String(actual).toLowerCase() === String(value).toLowerCase();
    case 'contains':
      return String(actual).toLowerCase().includes(String(value).toLowerCase());
    case 'gt':
      return Number(actual) > Number(value);
    case 'gte':
      return Number(actual) >= Number(value);
    case 'lt':
      return Number(actual) < Number(value);
    case 'lte':
      return Number(actual) <= Number(value);
    default:
      return false;
  }
}

export function ruleMatches(trade, rule) {
  if (!rule.conditions || rule.conditions.length === 0) return false;
  return rule.conditions.every((c) => evaluateCondition(trade, c));
}

/**
 * Runs all active tagging rules against the given trade IDs. Rules with
 * autoApply=true have their tags written immediately (merged via
 * $addToSet, never overwriting existing tags); autoApply=false rules are
 * returned as suggestions for the user to approve manually.
 */
export async function runAutoTagger(tradeIds, userId) {
  const rules = await TaggingRule.find({ userId, isActive: true }).lean();
  if (rules.length === 0) {
    return {
      applied: [],
      suggestions: [],
      note: 'No active tagging rules are configured.',
    };
  }

  const applied = [];
  const suggestions = [];

  for (const tradeId of tradeIds) {
    const trade = await tradeService.getTradeById(tradeId, userId);
    if (!trade) continue;

    const tagsToAdd = new Set();
    const suggestedForTrade = [];

    for (const rule of rules) {
      if (!ruleMatches(trade, rule)) continue;
      if (rule.autoApply) {
        rule.tagsToApply.forEach((t) => tagsToAdd.add(t));
      } else {
        suggestedForTrade.push({ ruleName: rule.name, tags: rule.tagsToApply });
      }
    }

    if (tagsToAdd.size > 0) {
      const newTags = Array.from(
        new Set([...(trade.tags || []), ...tagsToAdd]),
      );
      await tradeService.updateTrade(tradeId, { tags: newTags }, userId);
      applied.push({
        tradeId,
        symbol: trade.symbol,
        tagsApplied: Array.from(tagsToAdd),
      });
    }
    if (suggestedForTrade.length > 0) {
      suggestions.push({
        tradeId,
        symbol: trade.symbol,
        matches: suggestedForTrade,
      });
    }
  }

  return { applied, suggestions, note: null };
}

/** Applies one specific suggested rule's tags to one trade — the "approve" action. */
export async function approveSuggestion(tradeId, tags, userId) {
  const trade = await tradeService.getTradeById(tradeId, userId);
  if (!trade)
    throw Object.assign(new Error('Trade not found'), { statusCode: 404 });
  const newTags = Array.from(new Set([...(trade.tags || []), ...tags]));
  return tradeService.updateTrade(tradeId, { tags: newTags }, userId);
}

export default {
  evaluateCondition,
  ruleMatches,
  runAutoTagger,
  approveSuggestion,
};
