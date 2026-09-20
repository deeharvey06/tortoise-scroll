import { previewImport, commitImport } from '../services/importService.js';
import { listAdapters } from '../utils/csvAdapters.js';
import ImportJob from '../models/ImportJob.js';
import Account from '../models/Account.js';
import { ownedFilter } from '../utils/ownership.js';
import {
  importPreviewSchema,
  importCommitSchema,
} from '../schemas/settings.schema.js';

export async function getAdapters(req, res) {
  res.json(listAdapters());
}

export async function postPreview(req, res) {
  if (!req.file) {
    res.status(400);
    throw new Error('No CSV file uploaded (field name must be "file")');
  }
  // Validate request body
  const validated = importPreviewSchema.parse(req.body);
  const preview = await previewImport(req.file.buffer, validated.broker, {
    sourceTimezone: validated.sourceTimezone || 'UTC',
  });
  res.json(preview);
}

export async function postCommit(req, res) {
  if (!req.file) {
    res.status(400);
    throw new Error('No CSV file uploaded (field name must be "file")');
  }

  let parsedMapping = {};
  if (req.body && typeof req.body.mapping === 'string') {
    try {
      parsedMapping = JSON.parse(req.body.mapping);
    } catch (_error) {
      res.status(400);
      throw new Error('Invalid CSV mapping payload');
    }
  } else if (
    req.body &&
    req.body.mapping &&
    typeof req.body.mapping === 'object'
  ) {
    parsedMapping = req.body.mapping;
  }

  // Validate request body after decoding multipart mapping payloads
  const validated = importCommitSchema.parse({
    ...req.body,
    mapping: parsedMapping,
  });

  let mapping = {};
  if (validated.mapping) {
    mapping = validated.mapping;
  }
  if (
    !(await Account.exists(
      ownedFilter(req, { _id: validated.accountId, isActive: true })
    ))
  ) {
    res.status(404);
    throw new Error('Active account not found');
  }

  const job = await commitImport({
    accountId: validated.accountId,
    broker: validated.broker || 'generic',
    mapping,
    buffer: req.file.buffer,
    originalFilename: req.file.originalname,
    userId: req.user.id,
    sourceTimezone: validated.sourceTimezone || 'UTC',
  });

  res.status(201).json(job);
}

export async function getImportJob(req, res) {
  const job = await ImportJob.findOne(
    ownedFilter(req, { _id: req.params.id })
  ).lean();
  if (!job) {
    res.status(404);
    throw new Error('Import job not found');
  }
  res.json(job);
}

export async function listImportJobs(req, res) {
  const jobs = await ImportJob.find(ownedFilter(req))
    .sort({ createdAt: -1 })
    .skip(
      Math.max(0, Math.min(100000, Number.parseInt(req.query.offset, 10) || 0))
    )
    .limit(50)
    .select(req.query.summary === 'true' ? '-rows -mapping' : '')
    .lean();
  if (req.query.summary === 'true') {
    const accounts = await Account.find(
      ownedFilter(req, { _id: { $in: jobs.map((j) => j.accountId) } })
    )
      .select('name')
      .lean();
    for (const job of jobs)
      job.accountName =
        accounts.find((a) => String(a._id) === String(job.accountId))?.name ||
        'Unavailable account';
  }
  res.json(jobs);
}

export default {
  getAdapters,
  postPreview,
  postCommit,
  getImportJob,
  listImportJobs,
};

export async function getImportResults(req, res) {
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(req.query.page, 10) || 1)
  );
  const job = await ImportJob.findOne(ownedFilter(req, { _id: req.params.id }))
    .select({ rows: { $slice: [(page - 1) * 100, 100] } })
    .lean();
  if (!job)
    throw Object.assign(new Error('Import job not found'), { statusCode: 404 });
  const account = await Account.findOne(
    ownedFilter(req, { _id: job.accountId })
  )
    .select('name')
    .lean();
  // Execution duplicates may refer to a ledger fill rather than a completed trade.
  const { default: BrokerExecution } =
    await import('../models/BrokerExecution.js');
  const keys = job.rows
    .filter((r) => r.executionKey && !r.tradeId)
    .map((r) => r.executionKey);
  if (keys.length) {
    const fills = await BrokerExecution.find(
      ownedFilter(req, {
        accountId: job.accountId,
        broker: job.broker,
        executionKey: { $in: keys },
      })
    )
      .select('executionKey tradeId')
      .lean();
    for (const row of job.rows)
      row.tradeId ||=
        fills.find((f) => f.executionKey === row.executionKey)?.tradeId || null;
  }
  res.json({
    ...job,
    accountName: account?.name || 'Unavailable account',
    page,
    hasMore: job.rows.length === 100,
  });
}
