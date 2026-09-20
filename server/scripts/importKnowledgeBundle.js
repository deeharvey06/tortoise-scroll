import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import User, { normalizeEmail } from '../src/models/User.js';
import KnowledgeItem from '../src/models/KnowledgeItem.js';
import { getConfig } from '../src/config/index.js';
import { ingestSource, hash } from '../src/services/knowledge/ingestion.js';
import {
  createItem,
  createRelation,
} from '../src/services/knowledge/knowledgeService.js';

// Explicit local import only. Never runs on startup or during demo seeding.
// The bundle is private data and must not be committed to the repository.
dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
  quiet: true,
});
const bundlePath = process.argv[2];
if (!bundlePath || process.argv[3] !== '--configured-root')
  throw new Error(
    'Usage: node scripts/importKnowledgeBundle.js PRIVATE_BUNDLE.json --configured-root'
  );
const bundle = JSON.parse(await fs.readFile(bundlePath, 'utf8'));
if (!Array.isArray(bundle.sources) || !Array.isArray(bundle.items))
  throw new Error('Invalid private knowledge bundle');
try {
  await mongoose.connect(getConfig().mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });
  const root = await User.findOne({
    emailNormalized: normalizeEmail(process.env.ROOT_USER_EMAIL),
    role: 'ROOT',
    status: 'ACTIVE',
  });
  if (!root)
    throw new Error(
      'Configured active ROOT account was not found; no source data imported'
    );
  const sourceIds = [];
  for (const source of bundle.sources) {
    const result = await ingestSource(root._id, {
      name: source.location,
      buffer: await fs.readFile(
        path.resolve(path.dirname(bundlePath), source.path)
      ),
      sourceType: source.sourceType,
      incomplete: source.incomplete,
    });
    sourceIds.push(result.source._id);
  }
  let created = 0;
  let existing = 0;
  for (const candidate of bundle.items) {
    const { references, ...input } = candidate;
    const refs = references.map((ref) => ({
      sourceId: String(sourceIds[ref.sourceIndex]),
      sectionId: `page-${ref.page}`,
    }));
    const extractionKey = hash(
      JSON.stringify({ name: input.name, references: refs })
    );
    if (await KnowledgeItem.exists({ userId: root._id, extractionKey })) {
      existing++;
      continue;
    }
    const item = await createItem(root._id, { ...input, references: refs });
    item.extractionKey = extractionKey;
    await item.save();
    created++;
  }
  let relationships = 0;
  for (const relation of bundle.relationships || []) {
    const from = await KnowledgeItem.findOne({
      userId: root._id,
      name: relation.from,
    });
    const to = await KnowledgeItem.findOne({
      userId: root._id,
      name: relation.to,
    });
    if (!from || !to)
      throw new Error('Bundle relationship endpoint is missing');
    await createRelation(root._id, {
      from: String(from._id),
      to: String(to._id),
      type: relation.type,
      evidence: relation.evidence,
      references: relation.references.map((ref) => ({
        sourceId: String(sourceIds[ref.sourceIndex]),
        sectionId: `page-${ref.page}`,
      })),
    });
    relationships++;
  }
  console.log(
    JSON.stringify({
      owner: 'configured active ROOT account',
      sources: sourceIds.length,
      candidatesCreated: created,
      relationships,
      candidatesAlreadyPresent: existing,
      approval: 'none; all new candidates need user review',
    })
  );
} finally {
  await mongoose.disconnect();
}
