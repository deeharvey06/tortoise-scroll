import { normalizeExecution } from '../executionNormalizationService.js';

function config() {
  return {
    clientId:
      process.env.THINKORSWIM_CLIENT_ID || process.env.SCHWAB_CLIENT_ID || '',
    clientSecret:
      process.env.THINKORSWIM_CLIENT_SECRET ||
      process.env.SCHWAB_CLIENT_SECRET ||
      '',
    authorizeUrl:
      process.env.THINKORSWIM_AUTHORIZE_URL ||
      'https://api.schwabapi.com/v1/oauth/authorize',
    tokenUrl:
      process.env.THINKORSWIM_TOKEN_URL ||
      'https://api.schwabapi.com/v1/oauth/token',
    apiBase:
      process.env.THINKORSWIM_API_BASE_URL ||
      'https://api.schwabapi.com/trader/v1',
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error_description ||
        `Broker request failed (${response.status})`
    );
    error.providerStatus = response.status;
    error.providerBody = data;
    throw error;
  }
  return data;
}

function normalizeAccount(item) {
  const account = item?.securitiesAccount || item || {};
  return {
    providerAccountId: String(
      item?.hashValue || account?.accountNumber || account?.accountId || ''
    ),
    providerAccountNumberMasked: account?.accountNumber
      ? `…${String(account.accountNumber).slice(-4)}`
      : '',
    providerAccountName: account?.type || 'Thinkorswim account',
    raw: {
      type: account?.type || '',
      isDayTrader: Boolean(account?.isDayTrader),
    },
  };
}

function executionRowsFromOrders(orders = []) {
  const rows = [];
  for (const order of orders) {
    const activities = order?.orderActivityCollection || [];
    for (const activity of activities) {
      if (String(activity?.activityType || '').toUpperCase() !== 'EXECUTION')
        continue;
      for (const leg of activity?.executionLegs || []) {
        const orderLeg =
          (order?.orderLegCollection || []).find(
            (l) => Number(l.legId) === Number(leg.legId)
          ) ||
          order?.orderLegCollection?.[0] ||
          {};
        const instrument = orderLeg.instrument || {};
        rows.push({
          broker: 'thinkorswim',
          account: '',
          executionId: String(leg?.id || leg?.executionId || ''),
          orderId: String(order?.orderId || ''),
          symbol: instrument.symbol,
          assetType:
            String(instrument.assetType || '').toLowerCase() || undefined,
          side: /SELL/i.test(String(orderLeg.instruction || ''))
            ? 'sell'
            : 'buy',
          quantity: leg?.quantity,
          price: leg?.price,
          timestamp: leg?.time || activity?.executionTime || order?.closeTime,
          commission: Number(
            leg?.commission ?? activity?.commission ?? order?.commission ?? 0
          ),
          fees: Number(leg?.fees ?? activity?.fees ?? order?.fees ?? 0),
          multiplier:
            instrument?.assetType === 'OPTION' ? 100 : instrument?.multiplier,
          expiration:
            instrument?.expirationDate || instrument?.expiration || undefined,
          strike: instrument?.strikePrice ?? instrument?.strike,
          optionType: instrument?.putCall || instrument?.optionType,
          positionEffect: /TO_CLOSE/i.test(String(orderLeg.instruction || ''))
            ? 'close'
            : /TO_OPEN/i.test(String(orderLeg.instruction || ''))
              ? 'open'
              : 'unknown',
          status: 'filled',
          rawBrokerMetadata: {
            orderId: order?.orderId,
            activityType: activity?.activityType,
            costDataAvailable:
              leg?.commission != null ||
              activity?.commission != null ||
              order?.commission != null ||
              leg?.fees != null ||
              activity?.fees != null ||
              order?.fees != null,
          },
        });
      }
    }
  }
  return rows;
}

export const thinkorswimProvider = {
  key: 'thinkorswim',
  label: 'Thinkorswim / Schwab',
  getCapabilities() {
    return {
      executions: true,
      orders: true,
      positions: true,
      balances: false,
      historicalTransactions: false,
      incrementalSynchronization: true,
      realTimeUpdates: false,
      webhooks: false,
      optionsMetadata: true,
      futuresMetadata: true,
    };
  },
  beginAuthorization({ state, redirectUri }) {
    const { clientId, authorizeUrl } = config();
    if (!clientId)
      throw new Error('Thinkorswim/Schwab client ID is not configured');
    const url = new URL(authorizeUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  },
  async completeAuthorization({ code, redirectUri }) {
    const { clientId, clientSecret, tokenUrl } = config();
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    return requestJson(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  },
  async refreshAuthorization(refreshToken) {
    const { clientId, clientSecret, tokenUrl } = config();
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return requestJson(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  },
  async revokeConnection() {
    return { supported: false };
  },
  async getAccounts(accessToken) {
    const { apiBase } = config();
    const data = await requestJson(`${apiBase}/accounts/accountNumbers`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return (Array.isArray(data) ? data : [])
      .map(normalizeAccount)
      .filter((a) => a.providerAccountId);
  },
  async fetchExecutions(accessToken, { providerAccountId, from, to }) {
    const { apiBase } = config();
    const initialDays = Math.max(
      1,
      Math.min(60, Number(process.env.THINKORSWIM_INITIAL_SYNC_DAYS || 60))
    );
    const start = from
      ? new Date(from).toISOString()
      : new Date(Date.now() - initialDays * 86400000).toISOString();
    const end = to ? new Date(to).toISOString() : new Date().toISOString();
    const url = new URL(
      `${apiBase}/accounts/${encodeURIComponent(providerAccountId)}/orders`
    );
    url.searchParams.set('fromEnteredTime', start);
    url.searchParams.set('toEnteredTime', end);
    url.searchParams.set('status', 'FILLED');
    const orders = await requestJson(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const normalized = [];
    const rejected = [];
    const warnings = [];
    let missingCostData = false;
    for (const row of executionRowsFromOrders(
      Array.isArray(orders) ? orders : []
    )) {
      const result = normalizeExecution(row);
      if (result.execution) {
        normalized.push(result.execution);
        if (
          ['future', 'option'].includes(result.execution.assetType) &&
          !row.rawBrokerMetadata?.costDataAvailable
        )
          missingCostData = true;
      } else rejected.push({ errors: result.errors, raw: row });
    }
    if (missingCostData)
      warnings.push(
        'The broker order response did not include commission/fee data for one or more derivative executions; execution prices and quantities were synchronized but costs may require broker transaction data or manual reconciliation.'
      );
    return {
      executions: normalized,
      rejected,
      warnings,
      nextCursor: null,
      fetched: normalized.length + rejected.length,
    };
  },
  async fetchPositions(accessToken, { providerAccountId }) {
    const { apiBase } = config();
    const data = await requestJson(
      `${apiBase}/accounts/${encodeURIComponent(providerAccountId)}?fields=positions`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return (data?.securitiesAccount?.positions || [])
      .map((position) => ({
        symbol: position?.instrument?.symbol || '',
        assetType: String(position?.instrument?.assetType || '').toLowerCase(),
        quantity:
          Number(position?.longQuantity || 0) -
          Number(position?.shortQuantity || 0),
        averagePrice: Number(position?.averagePrice || 0),
      }))
      .filter((position) => position.symbol);
  },
  normalizeBrokerError(error) {
    const status = Number(error?.providerStatus || 0);
    if (status === 401 || status === 403)
      return {
        category: 'USER_ACTION_REQUIRED',
        code: 'AUTHORIZATION_EXPIRED',
        message: 'Broker authorization is no longer valid.',
      };
    if (status === 429)
      return {
        category: 'RETRYABLE',
        code: 'RATE_LIMITED',
        message: 'Broker rate limit reached.',
      };
    if (status >= 500 || !status)
      return {
        category: 'RETRYABLE',
        code: 'PROVIDER_UNAVAILABLE',
        message: error.message || 'Broker unavailable.',
      };
    return {
      category: 'PERMANENT_CONFIGURATION',
      code: 'BROKER_REQUEST_FAILED',
      message: error.message || 'Broker request failed.',
    };
  },
};
