import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
const screenshotsDir = path.join(uploadsRoot, 'screenshots');
const mediaDir = path.join(uploadsRoot, 'media');

fs.mkdirSync(screenshotsDir, { recursive: true });
fs.mkdirSync(mediaDir, { recursive: true });

// CSV imports are parsed in memory — files are small and we never need to
// keep the raw upload around after processing.
export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
    cb(ok ? null : new Error('Only .csv files are accepted'), ok);
  },
});

// Screenshots are kept on disk under /uploads/screenshots and served
// statically — see app.js.
export const screenshotUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, screenshotsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are accepted'), ok);
  },
});

export const uploadsRootPath = uploadsRoot;

// Shared image upload for Strategy/Playbook reference screenshots — same
// constraints as trade screenshots, stored under /uploads/media instead.
export const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, mediaDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are accepted'), ok);
  },
});

export default { csvUpload, screenshotUpload, mediaUpload, uploadsRootPath };
