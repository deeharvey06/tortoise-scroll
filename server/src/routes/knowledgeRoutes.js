import { buildTradeQuery } from '../services/tradeService.js';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import asyncHandler from '../middleware/asyncHandler.js';
import KnowledgeSource from '../models/KnowledgeSource.js';
import KnowledgeItem from '../models/KnowledgeItem.js';
import KnowledgeRelationship from '../models/KnowledgeRelationship.js';
import Trade from '../models/Trade.js';
import Account from '../models/Account.js';
import {
  SOURCE_TYPES,
  KINDS,
  STATUSES,
  RELATIONS,
  parse,
  fail,
  ids,
  id,
} from '../services/knowledge/schema.js';

import {
  owned,
  createItem,
  editItem,
  reviewRecord,
  createRelation,
  editRelation,
  attachKnowledge,
  referencesForTarget,
} from '../services/knowledge/knowledgeService.js';

import {
  ingestSource,
  readArchive,
  sourcePath,
} from '../services/knowledge/ingestion.js';

import {
  saveTradeContext,
  getTradeContext,
} from '../services/knowledge/tradeContext.js';

import {
  contextStatistics,
  matchesContext,
} from '../services/knowledge/processAnalytics.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 1, fields: 5, fieldSize: 20000 },
});

router.get('/metadata', (_req, res) =>
  res.json({
    sourceTypes: SOURCE_TYPES,
    kinds: KINDS,
    statuses: STATUSES,
    relationshipTypes: RELATIONS,
  })
);

router.get(
  '/sources',
  asyncHandler(async (req, res) =>
    res.json(
      await KnowledgeSource.find({ userId: req.user.id })
        .select('-sections')
        .sort({ createdAt: -1 })
        .lean()
    )
  )
);

router.post(
  '/sources',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const sourceType = parse(z.enum(SOURCE_TYPES), req.body.sourceType);

    if (
      !req.file &&
      !(typeof req.body.text === 'string' && req.body.text.trim())
    )
      throw fail(400, 'Add a source file or source text');

    const files = req.file
      ? /\.zip$/i.test(req.file.originalname)
        ? await readArchive(req.file.buffer)
        : [{ name: req.file.originalname, buffer: req.file.buffer }]
      : [
          {
            name: `${String(req.body.title || 'Personal notes').slice(0, 200)}.txt`,
            buffer: Buffer.from(req.body.text),
          },
        ];

    if (!files.length)
      throw fail(400, 'Archive contains no supported PDF or TXT sources');

    const results = [];
    for (const file of files) {
      try {
        const result = await ingestSource(req.user.id, {
          ...file,
          sourceType,
          incomplete: req.body.incomplete === 'true',
        });

        results.push({
          sourceId: result.source._id,
          title: result.source.title,
          duplicate: result.duplicate,
        });
      } catch (error) {
        results.push({
          title: file.name,
          error: error.statusCode ? error.message : 'Source could not be saved',
        });
      }
    }

    res.status(results.every((r) => r.error) ? 422 : 201).json({
      results,
      status: results.some((r) => r.error)
        ? 'partial_or_failed'
        : 'extracted_needs_review',
    });
  })
);

router.get(
  '/sources/:id',
  asyncHandler(async (req, res) =>
    res.json(await owned(KnowledgeSource, req.user.id, req.params.id))
  )
);

router.get(
  '/sources/:id/original',
  asyncHandler(async (req, res) => {
    const source = await owned(KnowledgeSource, req.user.id, req.params.id);
    res.set('Cache-Control', 'private, no-store');
    res.download(
      sourcePath(req.user.id, source),
      `source-${source._id}.${source.format}`,
      (error) => {
        if (error && !res.headersSent)
          res.status(404).json({
            error: {
              message:
                'Original file unavailable; restore the private uploads backup.',
            },
          });
      }
    );
  })
);

router.get(
  '/items',
  asyncHandler(async (req, res) => {
    const query = { userId: req.user.id };
    for (const field of ['kind', 'status', 'dimension'])
      if (typeof req.query[field] === 'string' && req.query[field])
        query[field] = req.query[field];
    if (req.query.sourceId)
      query['references.sourceId'] = parse(id, req.query.sourceId);
    if (req.query.search) {
      const re = new RegExp(
        String(req.query.search)
          .slice(0, 200)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
      query.$or = [
        'name',
        'interpretation',
        'classification',
        'references.heading',
        'references.location',
        'references.sourceType',
      ].map((field) => ({ [field]: re }));
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const [items, total] = await Promise.all([
      KnowledgeItem.find(query)
        .select('-history')
        .sort({ name: 1, _id: 1 })
        .skip((page - 1) * 100)
        .limit(100)
        .lean(),
      KnowledgeItem.countDocuments(query),
    ]);
    res.json({ items, total, page });
  })
);

router.post(
  '/items',
  asyncHandler(async (req, res) =>
    res.status(201).json(await createItem(req.user.id, req.body))
  )
);

router.get(
  '/items/:id',
  asyncHandler(async (req, res) =>
    res.json(await owned(KnowledgeItem, req.user.id, req.params.id))
  )
);

router.put(
  '/items/:id',
  asyncHandler(async (req, res) =>
    res.json(await editItem(req.user.id, req.params.id, req.body))
  )
);

router.post(
  '/items/:id/review',
  asyncHandler(async (req, res) =>
    res.json(
      await reviewRecord(KnowledgeItem, req.user.id, req.params.id, req.body)
    )
  )
);

router.get(
  '/relationships',
  asyncHandler(async (req, res) => {
    const query = { userId: req.user.id };
    if (req.query.itemId) {
      const itemId = parse(id, req.query.itemId);
      query.$or = [{ from: itemId }, { to: itemId }];
    }
    res.json(await KnowledgeRelationship.find(query).limit(1000).lean());
  })
);

router.post(
  '/relationships',
  asyncHandler(async (req, res) =>
    res.status(201).json(await createRelation(req.user.id, req.body))
  )
);

router.post(
  '/relationships/:id/review',
  asyncHandler(async (req, res) =>
    res.json(
      await reviewRecord(
        KnowledgeRelationship,
        req.user.id,
        req.params.id,
        req.body
      )
    )
  )
);

router.post(
  '/attach',
  asyncHandler(async (req, res) => {
    const value = parse(
      z
        .object({
          type: z.enum(['strategy', 'playbook']),
          targetId: id.nullable().default(null),
          knowledgeIds: ids,
        })
        .strict(),
      req.body
    );
    res.json(
      await attachKnowledge(
        req.user.id,
        value.type,
        value.targetId,
        value.knowledgeIds
      )
    );
  })
);

router.get(
  '/targets/:type/:id',
  asyncHandler(async (req, res) => {
    parse(z.enum(['strategy', 'playbook']), req.params.type);
    res.json(
      await referencesForTarget(req.user.id, req.params.type, req.params.id)
    );
  })
);

router.get(
  '/trades/:id',
  asyncHandler(async (req, res) =>
    res.json(await getTradeContext(req.user.id, req.params.id))
  )
);

router.put(
  '/trades/:id',
  asyncHandler(async (req, res) =>
    res.json(await saveTradeContext(req.user.id, req.params.id, req.body))
  )
);

router.post(
  '/analytics',
  asyncHandler(async (req, res) => {
    const value = parse(
      z
        .object({
          knowledgeIds: ids.default([]),
          symbol: z.string().max(100).optional(),
          setup: z.string().max(250).optional(),
          direction: z.enum(['long', 'short']).optional(),
          session: z.string().max(100).optional(),
          tags: z.array(z.string().max(200)).max(100).optional(),
          dateFrom: z.iso.datetime({ offset: true }).optional(),
          dateTo: z.iso.datetime({ offset: true }).optional(),
          review: z
            .object({
              contextCorrect: z.boolean().optional(),
              setupPresent: z.boolean().optional(),
              entryValid: z.boolean().optional(),
            })
            .strict()
            .optional(),
          accountId: id.optional(),
          strategy: id.optional(),
          playbook: id.optional(),
          followedPlan: z.boolean().nullable().optional(),
          scenarioMatched: z.boolean().nullable().optional(),
          process: z.string().max(100).optional(),
        })
        .strict(),
      req.body
    );

    const query = buildTradeQuery({ ...value, userId: req.user.id });
    for (const key of ['accountId', 'strategy', 'playbook'])
      if (value[key]) query[key] = value[key];
    const trades = (await Trade.find(query).lean()).filter((t) =>
      matchesContext(t, value)
    );

    const accounts = await Account.find({ userId: req.user.id })
      .select('_id currency')
      .lean();

    const groups = new Map();
    for (const trade of trades) {
      const currency =
        accounts.find((a) => String(a._id) === String(trade.accountId))
          ?.currency || 'UNKNOWN';
      if (!groups.has(currency)) groups.set(currency, []);
      groups.get(currency).push(trade);
    }

    res.json({
      origin: 'personal_performance',
      groups: [...groups].map(([currency, group]) => ({
        currency,
        ...contextStatistics(group),
      })),
      sampleSize: trades.filter((t) => t.exitTime && t.netPnL != null).length,
    });
  })
);

router.put(
  '/relationships/:id',
  asyncHandler(async (req, res) =>
    res.json(await editRelation(req.user.id, req.params.id, req.body))
  )
);
export default router;
