import path from 'path';
import fs from 'fs';
import Trade from '../models/Trade.js';
import { uploadsRootPath } from '../middleware/upload.js';
import { ownedFilter } from '../utils/ownership.js';

export async function uploadScreenshot(req, res) {
  if (!req.file) {
    res.status(400);
    throw new Error('No image uploaded (field name must be "file")');
  }
  const trade = await Trade.findOne(ownedFilter(req, { _id: req.params.id }));
  if (!trade) {
    res.status(404);
    throw new Error('Trade not found');
  }
  const url = `/uploads/screenshots/${req.file.filename}`;
  trade.screenshots.push({ url, caption: req.body.caption || '' });
  await trade.save();
  res.status(201).json(trade.toObject());
}

export async function updateScreenshotCaption(req, res) {
  const trade = await Trade.findOne(ownedFilter(req, { _id: req.params.id }));
  if (!trade) {
    res.status(404);
    throw new Error('Trade not found');
  }
  const shot = trade.screenshots.id(req.params.screenshotId);
  if (!shot) {
    res.status(404);
    throw new Error('Screenshot not found');
  }
  shot.caption = req.body.caption || '';
  await trade.save();
  res.json(trade.toObject());
}

export async function deleteScreenshot(req, res) {
  const trade = await Trade.findOne(ownedFilter(req, { _id: req.params.id }));
  if (!trade) {
    res.status(404);
    throw new Error('Trade not found');
  }
  const shot = trade.screenshots.id(req.params.screenshotId);
  if (shot) {
    // uploads root is served at /uploads, so strip that prefix to get the
    // on-disk path; failing to find the file is not fatal to the DB update.
    const filePath = path.join(uploadsRootPath, shot.url.replace(/^\/uploads\//, ''));
    fs.unlink(filePath, () => {});
  }
  trade.screenshots = trade.screenshots.filter((s) => String(s._id) !== req.params.screenshotId);
  await trade.save();
  res.json(trade.toObject());
}

export default { uploadScreenshot, updateScreenshotCaption, deleteScreenshot };
