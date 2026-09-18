import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as marketDataService from '../services/marketDataService.js';
import { MarketDataError } from '../services/marketData/errors.js';

export function createMarketDataRouter(service = marketDataService) {
  const router = Router();

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get(
    '/status',
    asyncHandler(async (req, res) =>
      res.json(await service.getStatus(req.user.id))
    )
  );

  router.get(
    '/datasets',
    asyncHandler(async (req, res) =>
      res.json({ datasets: await service.listDatasets(req.user.id) })
    )
  );

  router.get(
    '/candles',
    asyncHandler(async (req, res) => {
      const { datasetId, symbol, timeframe, from, to, session } = req.query;
      res.json(
        await service.getCandles({
          userId: req.user.id,
          datasetId,
          symbol,
          timeframe,
          from,
          to,
          session,
        })
      );
    })
  );

  // Typed, safe market-data errors (no local paths, contents, or vendor secrets).
  router.use((error, req, res, next) => {
    if (!(error instanceof MarketDataError)) return next(error);
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: req.requestId,
      },
    });
  });
  return router;
}

export default createMarketDataRouter();
