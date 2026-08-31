import { previewImport, commitImport } from '../services/importService.js';
import { listAdapters } from '../utils/csvAdapters.js';
import ImportJob from '../models/ImportJob.js';

export async function getAdapters(req, res) {
  res.json(listAdapters());
}

export async function postPreview(req, res) {
  if (!req.file) {
    res.status(400);
    throw new Error('No CSV file uploaded (field name must be "file")');
  }
  const { broker } = req.body;
  const preview = await previewImport(req.file.buffer, broker);
  res.json(preview);
}

export async function postCommit(req, res) {
  if (!req.file) {
    res.status(400);
    throw new Error('No CSV file uploaded (field name must be "file")');
  }
  const { accountId, broker } = req.body;
  if (!accountId) {
    res.status(400);
    throw new Error('accountId is required');
  }
  let mapping = {};
  if (req.body.mapping) {
    try {
      mapping = JSON.parse(req.body.mapping);
    } catch {
      res.status(400);
      throw new Error('mapping must be valid JSON');
    }
  }

  const job = await commitImport({
    accountId,
    broker: broker || 'generic',
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

export default { getAdapters, postPreview, postCommit, getImportJob, listImportJobs };
