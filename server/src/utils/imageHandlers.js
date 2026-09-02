import path from 'path';
import fs from 'fs';
import { uploadsRootPath } from '../middleware/upload.js';

/**
 * Returns upload/updateCaption/delete handlers bound to a specific
 * Mongoose model whose schema has a `screenshots: [{url, caption}]` array —
 * used identically by Strategy and Playbook so the image-management logic
 * (and the on-disk cleanup on delete) exists in exactly one place.
 */
export function createImageHandlers(Model) {
  async function upload(req, res) {
    const doc = await Model.findOne({ _id: req.params.id, userId: req.user.id });
    if (!doc) {
      res.status(404);
      throw new Error('Not found');
    }
    if (!req.file) {
      res.status(400);
      throw new Error('No file uploaded');
    }
    const url = `/uploads/media/${req.file.filename}`;
    doc.screenshots.push({ url, caption: req.body.caption || '' });
    await doc.save();
    res.status(201).json(doc.toObject());
  }

  async function updateCaption(req, res) {
    const doc = await Model.findOne({ _id: req.params.id, userId: req.user.id });
    if (!doc) {
      res.status(404);
      throw new Error('Not found');
    }
    const shot = doc.screenshots.id(req.params.imageId);
    if (!shot) {
      res.status(404);
      throw new Error('Image not found');
    }
    shot.caption = req.body.caption ?? shot.caption;
    await doc.save();
    res.json(doc.toObject());
  }

  async function remove(req, res) {
    const doc = await Model.findOne({ _id: req.params.id, userId: req.user.id });
    if (!doc) {
      res.status(404);
      throw new Error('Not found');
    }
    const shot = doc.screenshots.id(req.params.imageId);
    if (shot) {
      const filePath = path.join(uploadsRootPath, shot.url.replace(/^\/uploads\//, ''));
      fs.unlink(filePath, () => {});
    }
    doc.screenshots = doc.screenshots.filter((s) => String(s._id) !== req.params.imageId);
    await doc.save();
    res.json(doc.toObject());
  }

  return { upload, updateCaption, remove };
}

export default createImageHandlers;
