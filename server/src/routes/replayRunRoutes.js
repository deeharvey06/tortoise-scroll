import { Router } from 'express';
import multer from 'multer';
import asyncHandler from '../middleware/asyncHandler.js';
import replayService from '../services/replay/replayService.js';
import { ReplayError } from '../services/replay/replayEngine.js';
import { MarketDataError } from '../services/marketData/errors.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1, fields: 2 },
});
export function createReplayRunRouter(service = replayService) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get(
    '/datasets',
    asyncHandler(async (req, res) =>
      res.json(await service.datasets(req.user.id))
    )
  );

  router.get(
    '/runs',
    asyncHandler(async (req, res) => res.json(await service.list(req.user.id)))
  );

  router.post(
    '/runs',
    asyncHandler(async (req, res) =>
      res.status(201).json(await service.create(req.user.id, req.body))
    )
  );

  router.get(
    '/runs/:id',
    asyncHandler(async (req, res) =>
      res.json(await service.get(req.user.id, req.params.id))
    )
  );

  router.post(
    '/runs/:id/control',
    asyncHandler(async (req, res) =>
      res.json(await service.control(req.user.id, req.params.id, req.body))
    )
  );

  router.post(
    '/runs/:id/events',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await service.addEvent(req.user.id, req.params.id, req.body))
    )
  );

  router.delete(
    '/runs/:id/events/:eventId',
    asyncHandler(async (req, res) =>
      res.json(
        await service.removeEvent(
          req.user.id,
          req.params.id,
          req.params.eventId,
          req.body
        )
      )
    )
  );

  router.post(
    '/runs/:id/screenshots',
    upload.single('file'),
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await service.screenshot(
            req.user.id,
            req.params.id,
            req.body,
            req.file
          )
        )
    )
  );

  router.get(
    '/runs/:id/screenshots/:shotId',
    asyncHandler(async (req, res) => {
      const file = await service.screenshotPath(
        req.user.id,
        req.params.id,
        req.params.shotId
      );
      res.type('png').sendFile(file, (error) => {
        if (error && !res.headersSent)
          res
            .status(404)
            .json({ error: { message: 'Screenshot file unavailable.' } });
      });
    })
  );

  router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError)
      return res.status(413).json({
        error: {
          code: error.code,
          message: 'Screenshot exceeds upload limits.',
        },
      });

    if (!(error instanceof ReplayError) && !(error instanceof MarketDataError))
      return next(error);

    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        requestId: req.requestId,
      },
    });
  });

  return router;
}
