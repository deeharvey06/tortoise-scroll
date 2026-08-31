import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { mediaUpload } from '../middleware/upload.js';
import Playbook from '../models/Playbook.js';
import createImageHandlers from '../utils/imageHandlers.js';
import {
  listPlaybooks,
  getPlaybook,
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
  getPlaybookPerformance,
} from '../controllers/playbookController.js';

const router = Router();
const images = createImageHandlers(Playbook);

router.get('/', asyncHandler(listPlaybooks));
router.post('/', asyncHandler(createPlaybook));
router.get('/:id', asyncHandler(getPlaybook));
router.put('/:id', asyncHandler(updatePlaybook));
router.delete('/:id', asyncHandler(deletePlaybook));
router.get('/:id/performance', asyncHandler(getPlaybookPerformance));
router.post('/:id/images', mediaUpload.single('file'), asyncHandler(images.upload));
router.put('/:id/images/:imageId', asyncHandler(images.updateCaption));
router.delete('/:id/images/:imageId', asyncHandler(images.remove));

export default router;
