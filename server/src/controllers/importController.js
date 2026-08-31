import { previewImport, commitImport } from '../services/importService.js';
import { listAdapters } from '../utils/csvAdapters.js';
import ImportJob from '../models/ImportJob.js';
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
  // Validate request body
  const validated = importCommitSchema.parse(req.body);

  let mapping = {};
  if (validated.mapping) {
    mapping = validated.mapping;
  }

  const job = await commitImport({
    accountId: validated.accountId,
    broker: validated.broker || 'generic',
    mapping,
    buffer: req.file.buffer,
    originalFilename: req.file.originalname,
  });

  res.status(201).json(job);
}

export async function getImportJob(req, res) {
  const job = await ImportJob.findById(req.params.id).lean();
  if (!job) {
    res.status(404);
    throw new Error('Import job not found');
  }
  res.json(job);
}

export async function listImportJobs(req, res) {
  const jobs = await ImportJob.find().sort({ createdAt: -1 }).limit(50).lean();
  res.json(jobs);
}

export default {
  getAdapters,
  postPreview,
  postCommit,
  getImportJob,
  listImportJobs,
};
