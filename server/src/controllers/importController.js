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
  const preview = await previewImport(req.file.buffer, validated.broker);
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
    } catch (error) {
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
  if (!(await Account.exists(ownedFilter(req, { _id: validated.accountId })))) { res.status(404); throw new Error('Account not found'); }

  const job = await commitImport({
    accountId: validated.accountId,
    broker: validated.broker || 'generic',
    mapping,
    buffer: req.file.buffer,
    originalFilename: req.file.originalname,
    userId: req.user.id,
  });

  res.status(201).json(job);
}

export async function getImportJob(req, res) {
  const job = await ImportJob.findOne(ownedFilter(req, { _id: req.params.id })).lean();
  if (!job) {
    res.status(404);
    throw new Error('Import job not found');
  }
  res.json(job);
}

export async function listImportJobs(req, res) {
  const jobs = await ImportJob.find(ownedFilter(req)).sort({ createdAt: -1 }).limit(50).lean();
  res.json(jobs);
}

export default {
  getAdapters,
  postPreview,
  postCommit,
  getImportJob,
  listImportJobs,
};
