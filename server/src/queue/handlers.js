/**
 * Job handlers for common backend tasks
 *
 * Handlers are registered with jobQueue and execute long-running operations
 * asynchronously, freeing up the request/response cycle.
 */

import * as importService from '../services/importService.js';
import * as performanceAgent from '../agents/performanceAgent.js';
import * as riskAgent from '../agents/riskAgent.js';
import * as autoTaggerAgent from '../agents/autoTaggerAgent.js';

/**
 * Handler for importing trades from CSV
 * Payload: { buffer, brokerKey, mapping, accountId }
 */
export async function handleTradeImport(payload, reportProgress) {
  const { buffer, brokerKey, mapping, accountId } = payload;

  try {
    reportProgress(10);
    const parsed = await importService.parseCsvBuffer(buffer);
    reportProgress(25);

    const rows = parsed.rows;
    const results = {
      successful: [],
      failed: [],
    };

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const trade = importService.buildRowPayload(
          row,
          mapping,
          brokerKey,
          accountId,
        );

        if (trade.errors && trade.errors.length > 0) {
          results.failed.push({
            rowIndex: i,
            errors: trade.errors,
            data: row,
          });
        } else {
          const created = await importService.createTrade(trade.payload);
          results.successful.push(created);
        }
      } catch (err) {
        results.failed.push({
          rowIndex: i,
          errors: [err.message],
          data: rows[i],
        });
      }

      const progressPercent = 25 + (i / rows.length) * 75;
      reportProgress(Math.round(progressPercent));
    }

    reportProgress(100);
    return results;
  } catch (err) {
    throw new Error(`Import failed: ${err.message}`);
  }
}

/**
 * Handler for performance analysis
 * Payload: { accountId, closedTrades }
 */
export async function handlePerformanceAnalysis(payload, reportProgress) {
  const { accountId, closedTrades } = payload;

  try {
    reportProgress(20);
    const summary = await performanceAgent.analyzePerformance(
      accountId,
      closedTrades,
    );
    reportProgress(100);
    return summary;
  } catch (err) {
    throw new Error(`Performance analysis failed: ${err.message}`);
  }
}

/**
 * Handler for risk assessment
 * Payload: { accountId, trades, config }
 */
export async function handleRiskAssessment(payload, reportProgress) {
  const { accountId, trades, config } = payload;

  try {
    reportProgress(20);
    const assessment = await riskAgent.assessRisk(accountId, trades, config);
    reportProgress(100);
    return assessment;
  } catch (err) {
    throw new Error(`Risk assessment failed: ${err.message}`);
  }
}

/**
 * Handler for auto-tagging trades
 * Payload: { tradeIds, rules }
 */
export async function handleAutoTagger(payload, reportProgress) {
  const { tradeIds, rules } = payload;

  try {
    reportProgress(20);
    const results = await autoTaggerAgent.applyRules(tradeIds, rules);
    reportProgress(100);
    return results;
  } catch (err) {
    throw new Error(`Auto-tagging failed: ${err.message}`);
  }
}
