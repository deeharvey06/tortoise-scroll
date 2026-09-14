import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  getBrokerProvider,
  listBrokerProviders,
} from '../services/brokers/providerRegistry.js';
import {
  beginBrokerAuthorization,
  completeBrokerAuthorization,
  discoverAccounts,
  disconnectBrokerConnection,
  listConnections,
  listSyncHistory,
  mapBrokerAccount,
  syncBrokerConnection,
} from '../services/brokerSyncService.js';

const router = Router();
router.get('/providers', (req, res) => res.json(listBrokerProviders()));
router.get(
  '/',
  asyncHandler(async (req, res) => res.json(await listConnections(req.user.id)))
);
router.post(
  '/:provider/authorize',
  asyncHandler(async (req, res) => {
    getBrokerProvider(req.params.provider);
    const redirectUri =
      process.env.BROKER_OAUTH_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/broker-connections/${req.params.provider}/callback`;
    res.json(
      await beginBrokerAuthorization({
        userId: req.user.id,
        sessionId: req.sessionID,
        providerKey: req.params.provider,
        redirectUri,
      })
    );
  })
);
router.get(
  '/:provider/callback',
  asyncHandler(async (req, res) => {
    const result = await completeBrokerAuthorization({
      userId: req.user.id,
      sessionId: req.sessionID,
      providerKey: req.params.provider,
      state: req.query.state,
      code: req.query.code,
    });
    res.redirect(
      `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/settings?brokerConnection=${result.connection._id}`
    );
  })
);
router.post(
  '/:id/reconnect',
  asyncHandler(async (req, res) => {
    const connection = (await listConnections(req.user.id)).find(
      (item) => String(item._id) === String(req.params.id)
    );
    if (!connection)
      throw Object.assign(new Error('Broker connection not found'), {
        statusCode: 404,
      });
    const redirectUri =
      process.env.BROKER_OAUTH_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/broker-connections/${connection.provider}/callback`;
    res.json(
      await beginBrokerAuthorization({
        userId: req.user.id,
        sessionId: req.sessionID,
        providerKey: connection.provider,
        redirectUri,
        connectionId: req.params.id,
      })
    );
  })
);
router.get(
  '/:id/accounts',
  asyncHandler(async (req, res) =>
    res.json(await discoverAccounts(req.params.id, req.user.id))
  )
);
router.post(
  '/:id/mappings',
  asyncHandler(async (req, res) =>
    res.json(
      await mapBrokerAccount({
        userId: req.user.id,
        connectionId: req.params.id,
        providerAccountId: req.body.providerAccountId,
        accountId: req.body.accountId,
      })
    )
  )
);
router.post(
  '/:id/sync',
  asyncHandler(async (req, res) =>
    res.json(
      await syncBrokerConnection({
        userId: req.user.id,
        connectionId: req.params.id,
        syncType: 'manual',
      })
    )
  )
);
router.get(
  '/:id/history',
  asyncHandler(async (req, res) =>
    res.json(await listSyncHistory(req.user.id, req.params.id))
  )
);
router.delete(
  '/:id',
  asyncHandler(async (req, res) =>
    res.json(
      await disconnectBrokerConnection({
        userId: req.user.id,
        connectionId: req.params.id,
      })
    )
  )
);
export default router;
