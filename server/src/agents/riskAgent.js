import { computeRiskDashboard } from '../services/riskDashboardService.js';
import { narrate } from './narrate.js';

/**
 * Spec section 20 Agent 4: monitors daily drawdown, position sizing,
 * consecutive losses, trade count, and risk per trade, generating warnings
 * like "You are approaching your configured daily loss limit." This is
 * exactly what riskDashboardService already computes for the Risk page —
 * the agent just packages it as findings and optionally narrates them.
 */
export async function generateRiskAlert(accountId, userId) {
  const { settings, current, warnings } = await computeRiskDashboard(accountId || null, userId);

  const findings =
    warnings.length > 0
      ? warnings
      : settings
      ? ['No risk limits are currently being approached.']
      : ['No risk limits are configured yet — set them on the Risk page to enable this monitor.'];

  const narrative = await narrate(findings, { title: 'Risk Monitor', userId });
  return { settings, current, warnings, findings, narrative };
}

export default { generateRiskAlert };
