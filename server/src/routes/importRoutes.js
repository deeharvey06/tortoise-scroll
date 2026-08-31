import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { csvUpload } from '../middleware/upload.js';
import {
  getAdapters,
  postPreview,
  postCommit,
  getImportJob,
  listImportJobs,
} from '../controllers/importController.js';

const router = Router();

router.get('/adapters', asyncHandler(getAdapters));
router.get('/jobs', asyncHandler(listImportJobs));
router.get('/jobs/:id', asyncHandler(getImportJob));
router.post('/preview', csvUpload.single('file'), asyncHandler(postPreview));
router.post('/commit', csvUpload.single('file'), asyncHandler(postCommit));

export default router;
