import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  listEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
} from '../controllers/journalController.js';

const router = Router();

router.get('/', asyncHandler(listEntries));
router.post('/', asyncHandler(createEntry));
router.get('/:id', asyncHandler(getEntry));
router.put('/:id', asyncHandler(updateEntry));
router.delete('/:id', asyncHandler(deleteEntry));

export default router;
