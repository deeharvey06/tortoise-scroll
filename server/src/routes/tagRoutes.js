import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { listTags, createTag, deleteTag } from '../controllers/tagController.js';

const router = Router();

router.get('/', asyncHandler(listTags));
router.post('/', asyncHandler(createTag));
router.delete('/:id', asyncHandler(deleteTag));

export default router;
