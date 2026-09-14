import crypto from 'crypto';
import BrokerConnection from '../models/BrokerConnection.js';
import BrokerSyncRun from '../models/BrokerSyncRun.js';
import BrokerExecution from '../models/BrokerExecution.js';
import BrokerAuthorizationState from '../models/BrokerAuthorizationState.js';
import Account from '../models/Account.js';
import Trade from '../models/Trade.js';
import {
  encryptSecret,
  decryptSecret,
  redactConnection,
} from './brokerSecretService.js';

import { getBrokerProvider } from './brokers/providerRegistry.js';
import {
  reconstructPositions,
  positionToTradePayload,
} from './positionReconstructionService.js';

import { createTrade, updateTrade } from './tradeService.js';

const sha256 = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');
const nowPlus = (ms) => new Date(Date.now() + ms);

export async function beginBrokerAuthorization({
  userId,
  sessionId,
  providerKey,
  redirectUri,
  connectionId = null,
}) {
  const provider = getBrokerProvider(providerKey);
  if (connectionId) {
    const existing = await BrokerConnection.exists({
      _id: connectionId,
      userId,
      provider: provider.key,
    });
    if (!existing)
      throw Object.assign(new Error('Broker connection not found'), {
        statusCode: 404,
      });
  }

  const state = crypto.randomBytes(32).toString('base64url');
  await BrokerAuthorizationState.create({
    userId,
    provider: provider.key,
    connectionId,
    stateHash: sha256(state),
    sessionHash: sha256(sessionId),
    redirectUri,
    expiresAt: nowPlus(10 * 60 * 1000),
  });
  return {
    authorizationUrl: provider.beginAuthorization({ state, redirectUri }),
    stateExpiresAt: nowPlus(10 * 60 * 1000),
  };
}

export async function completeBrokerAuthorization({
  userId,
  sessionId,
  providerKey,
  state,
  code,
}) {
  const provider = getBrokerProvider(providerKey);
  const authState = await BrokerAuthorizationState.findOne({
    userId,
    provider: provider.key,
    connectionId: authState.connectionId,
    stateHash: sha256(state),
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!authState || authState.sessionHash !== sha256(sessionId)) {
    throw Object.assign(
      new Error('Invalid or expired broker authorization state'),
      { statusCode: 400 }
    );
  }

  authState.consumedAt = new Date();
  await authState.save();

  const tokens = await provider.completeAuthorization({
    code,
    redirectUri: authState.redirectUri,
  });

  let connection;
  if (authState.connectionId) {
    connection = await BrokerConnection.findOne({
      _id: authState.connectionId,
      userId,
      provider: provider.key,
    });

    if (!connection)
      throw Object.assign(new Error('Broker connection not found'), {
        statusCode: 404,
      });

    connection.status = 'connected';
    connection.accessTokenEncrypted = encryptSecret(tokens.access_token);

    if (tokens.refresh_token)
      connection.refreshTokenEncrypted = encryptSecret(tokens.refresh_token);

    connection.tokenExpiresAt = tokens.expires_in
      ? nowPlus(Number(tokens.expires_in) * 1000)
      : null;

    connection.grantedScopes = String(tokens.scope || '')
      .split(/\s+/)
      .filter(Boolean);

    connection.revokedAt = null;
    connection.lastError = undefined;
    connection.nextSyncAt = new Date();
    await connection.save();
  } else {
    connection = await BrokerConnection.create({
      userId,
      provider: provider.key,
      status: 'connected',
      accessTokenEncrypted: encryptSecret(tokens.access_token),
      refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
      tokenExpiresAt: tokens.expires_in
        ? nowPlus(Number(tokens.expires_in) * 1000)
        : null,
      grantedScopes: String(tokens.scope || '')
        .split(/\s+/)
        .filter(Boolean),
      nextSyncAt: null,
    });
  }

  const accounts = await discoverAccounts(connection);
  return { connection: redactConnection(connection), accounts };
}

async function ensureAccessToken(connection) {
  const provider = getBrokerProvider(connection.provider);
  const shouldRefresh =
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() < Date.now() + 60_000;

  if (shouldRefresh) {
    const refresh = decryptSecret(connection.refreshTokenEncrypted);
    if (!refresh) throw new Error('Broker refresh token is unavailable');

    const tokens = await provider.refreshAuthorization(refresh);
    connection.accessTokenEncrypted = encryptSecret(tokens.access_token);

    if (tokens.refresh_token)
      connection.refreshTokenEncrypted = encryptSecret(tokens.refresh_token);

    connection.tokenExpiresAt = tokens.expires_in
      ? nowPlus(Number(tokens.expires_in) * 1000)
      : connection.tokenExpiresAt;
    await connection.save();
  }

  return decryptSecret(connection.accessTokenEncrypted);
}

export async function discoverAccounts(connectionOrId, userId = null) {
  const connection =
    typeof connectionOrId === 'string'
      ? await BrokerConnection.findOne({ _id: connectionOrId, userId })
      : connectionOrId;

  if (!connection)
    throw Object.assign(new Error('Broker connection not found'), {
      statusCode: 404,
    });

  const provider = getBrokerProvider(connection.provider);
  const accessToken = await ensureAccessToken(connection);
  const accounts = await provider.getAccounts(accessToken);
  connection.providerMetadata = {
    ...connection.providerMetadata,
    discoveredAccounts: accounts.map(({ raw, ...a }) => a),
  };

  await connection.save();
  return accounts.map(({ raw, ...a }) => a);
}

export async function mapBrokerAccount({
  userId,
  connectionId,
  providerAccountId,
  accountId,
}) {
  const [connection, account] = await Promise.all([
    BrokerConnection.findOne({ _id: connectionId, userId }),
    Account.findOne({ _id: accountId, userId }),
  ]);

  if (!connection)
    throw Object.assign(new Error('Broker connection not found'), {
      statusCode: 404,
    });

  if (!account)
    throw Object.assign(new Error('Account not found'), { statusCode: 404 });

  const discovered = connection.providerMetadata?.discoveredAccounts || [];
  const brokerAccount = discovered.find(
    (a) => a.providerAccountId === providerAccountId
  );

  if (!brokerAccount)
    throw Object.assign(
      new Error('Broker account was not discovered for this connection'),
      { statusCode: 400 }
    );

  connection.accountMappings = connection.accountMappings.filter(
    (m) => m.providerAccountId !== providerAccountId
  );

  connection.accountMappings.push({
    providerAccountId,
    providerAccountNumberMasked:
      brokerAccount.providerAccountNumberMasked || '',
    providerAccountName: brokerAccount.providerAccountName || '',
    accountId,
  });

  connection.nextSyncAt = new Date();
  await connection.save();
  return redactConnection(connection);
}

async function reconstructAccount({ userId, accountId, broker, connectionId }) {
  const ledger = await BrokerExecution.find({
    userId,
    accountId,
    broker,
    status: { $nin: ['cancelled', 'rejected'] },
  })
    .sort({ timestamp: 1, executionKey: 1 })
    .lean();

  const result = reconstructPositions(ledger, { policy: 'fifo' });
  let created = 0;
  let updated = 0;

  for (const position of result.positions) {
    const payload = positionToTradePayload(position, accountId);
    const existing = await Trade.findOne({
      userId,
      accountId,
      sourcePositionKey: position.sourcePositionKey,
    });

    const trade = existing
      ? await updateTrade(existing._id, payload, userId)
      : await createTrade(payload, userId);
    existing ? updated++ : created++;
    const keys = position.executions.map(
      (e) => e.sourceExecutionKey || e.executionKey
    );

    await BrokerExecution.updateMany(
      { userId, accountId, broker, executionKey: { $in: keys } },
      { $set: { tradeId: trade._id, brokerConnectionId: connectionId } }
    );
  }

  return {
    created,
    updated,
    openPositions: result.openPositions.length,
    openPositionSummaries: result.positions
      .filter((position) => position.status === 'open')
      .map((position) => ({
        symbol: position.symbol,
        quantity:
          position.direction === 'long'
            ? Number(position.remainingQuantity)
            : -Number(position.remainingQuantity),
      })),
    warnings: result.warnings,
  };
}

async function persistExecutions({
  userId,
  accountId,
  connectionId,
  provider,
  executions,
}) {
  let inserted = 0;
  let duplicates = 0;

  for (const execution of executions) {
    try {
      await BrokerExecution.create({
        ...execution,
        userId,
        accountId,
        brokerConnectionId: connectionId,
        sources: [{ sourceType: 'api', brokerConnectionId: connectionId }],
      });

      inserted++;
    } catch (error) {
      if (error?.code === 11000) {
        duplicates++;
        await BrokerExecution.updateOne(
          {
            userId,
            accountId,
            broker: provider,
            executionKey: execution.executionKey,
          },
          {
            $addToSet: {
              sources: { sourceType: 'api', brokerConnectionId: connectionId },
            },
          }
        ).catch(() => {});
      } else throw error;
    }
  }

  return { inserted, duplicates };
}

export async function syncBrokerConnection({
  userId,
  connectionId,
  syncType = 'manual',
}) {
  const connection = await BrokerConnection.findOne({
    _id: connectionId,
    userId,
  });

  if (!connection)
    throw Object.assign(new Error('Broker connection not found'), {
      statusCode: 404,
    });

  if (connection.status === 'disconnected')
    throw Object.assign(new Error('Broker connection is disconnected'), {
      statusCode: 409,
    });

  const provider = getBrokerProvider(connection.provider);
  const run = await BrokerSyncRun.create({
    userId,
    connectionId,
    provider: connection.provider,
    syncType,
    checkpointBefore: connection.syncCheckpoint || {},
  });

  connection.status = 'syncing';
  connection.lastAttemptedSyncAt = new Date();
  await connection.save();

  try {
    const accessToken = await ensureAccessToken(connection);
    let totalFetched = 0;
    let totalInserted = 0;
    let totalDuplicates = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalOpen = 0;
    let totalRejected = 0;
    const warnings = [];
    const pendingCheckpoint = structuredClone(connection.syncCheckpoint || {});
    pendingCheckpoint.accounts ||= {};

    for (const mapping of connection.accountMappings) {
      const owned = await Account.exists({ _id: mapping.accountId, userId });
      if (!owned)
        throw new Error(
          'Mapped Tortoise Scroll account is not owned by the authenticated user'
        );

      const priorTimestamp =
        pendingCheckpoint.accounts?.[mapping.providerAccountId]?.timestamp ||
        null;

      const response = await provider.fetchExecutions(accessToken, {
        providerAccountId: mapping.providerAccountId,
        from: priorTimestamp,
      });

      totalFetched += response.fetched || response.executions.length;
      totalRejected += response.rejected?.length || 0;
      warnings.push(...(response.warnings || []));

      const persisted = await persistExecutions({
        userId,
        accountId: mapping.accountId,
        connectionId,
        provider: connection.provider,
        executions: response.executions,
      });

      totalInserted += persisted.inserted;
      totalDuplicates += persisted.duplicates;

      const recon = await reconstructAccount({
        userId,
        accountId: mapping.accountId,
        broker: connection.provider,
        connectionId,
      });

      totalCreated += recon.created;
      totalUpdated += recon.updated;
      totalOpen += recon.openPositions;
      warnings.push(...recon.warnings);

      if (provider.getCapabilities().positions && provider.fetchPositions) {
        const brokerPositions = await provider.fetchPositions(accessToken, {
          providerAccountId: mapping.providerAccountId,
        });

        const localBySymbol = new Map();
        for (const position of recon.openPositionSummaries)
          localBySymbol.set(
            position.symbol,
            (localBySymbol.get(position.symbol) || 0) + position.quantity
          );

        for (const brokerPosition of brokerPositions) {
          const localQuantity = Number(
            localBySymbol.get(brokerPosition.symbol) || 0
          );

          if (
            Math.abs(localQuantity - Number(brokerPosition.quantity || 0)) >
            1e-9
          )
            warnings.push(
              `Position mismatch for ${brokerPosition.symbol}: broker ${brokerPosition.quantity}, Tortoise Scroll ${localQuantity}`
            );

          localBySymbol.delete(brokerPosition.symbol);
        }

        for (const [symbol, quantity] of localBySymbol)
          if (Math.abs(quantity) > 1e-9)
            warnings.push(
              `Position mismatch for ${symbol}: broker 0, Tortoise Scroll ${quantity}`
            );
      }

      const timestamps = response.executions
        .map((e) => new Date(e.timestamp).getTime())
        .filter(Number.isFinite);

      if (timestamps.length) {
        const newestTimestamp = new Date(
          Math.max(
            priorTimestamp ? new Date(priorTimestamp).getTime() : 0,
            ...timestamps
          )
        ).toISOString();
        pendingCheckpoint.accounts[mapping.providerAccountId] = {
          timestamp: newestTimestamp,
        };
      }
    }

    connection.syncCheckpoint = pendingCheckpoint;
    connection.lastSuccessfulSyncAt = new Date();
    connection.nextSyncAt = nowPlus(
      Number(process.env.BROKER_SYNC_INTERVAL_MS || 300000)
    );

    connection.status = 'connected';
    connection.lastError = undefined;
    await connection.save();

    run.status = 'completed';
    run.completedAt = new Date();
    run.checkpointAfter = connection.syncCheckpoint;
    run.warnings = warnings;
    run.summary = {
      accountsDiscovered:
        connection.providerMetadata?.discoveredAccounts?.length || 0,
      recordsFetched: totalFetched,
      executionsInserted: totalInserted,
      duplicates: totalDuplicates,
      tradesReconstructed: totalCreated,
      tradesUpdated: totalUpdated,
      openPositions: totalOpen,
      warnings: warnings.length,
      rejectedRecords: totalRejected,
      errors: 0,
    };

    await run.save();
    return run.toObject();
  } catch (error) {
    const normalized = provider.normalizeBrokerError(error);
    connection.status =
      normalized.code === 'AUTHORIZATION_EXPIRED'
        ? 'authorization_expired'
        : normalized.code === 'RATE_LIMITED'
          ? 'rate_limited'
          : normalized.code === 'PROVIDER_UNAVAILABLE'
            ? 'provider_unavailable'
            : 'attention_required';

    connection.lastError = { ...normalized, at: new Date() };
    await connection.save();

    run.status = 'failed';
    run.completedAt = new Date();
    run.errors = [normalized.message];
    run.summary.errors = 1;

    await run.save();
    throw Object.assign(new Error(normalized.message), {
      statusCode: normalized.category === 'USER_ACTION_REQUIRED' ? 409 : 502,
    });
  }
}

export async function disconnectBrokerConnection({ userId, connectionId }) {
  const connection = await BrokerConnection.findOne({
    _id: connectionId,
    userId,
  });
  if (!connection)
    throw Object.assign(new Error('Broker connection not found'), {
      statusCode: 404,
    });
  const provider = getBrokerProvider(connection.provider);
  try {
    await provider.revokeConnection(
      decryptSecret(connection.accessTokenEncrypted)
    );
  } catch {
    /* provider revocation is best-effort */
  }
  connection.status = 'disconnected';
  connection.revokedAt = new Date();
  connection.accessTokenEncrypted = null;
  connection.refreshTokenEncrypted = null;
  connection.tokenExpiresAt = null;
  connection.nextSyncAt = null;
  await connection.save();
  return redactConnection(connection);
}

export async function listConnections(userId) {
  const connections = await BrokerConnection.find({ userId }).sort({
    createdAt: -1,
  });
  return connections.map(redactConnection);
}
export async function listSyncHistory(userId, connectionId) {
  return BrokerSyncRun.find({ userId, connectionId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
}
