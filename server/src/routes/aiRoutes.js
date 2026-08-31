import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  getStatus,
  getSettings,
  saveSettings,
  listConversations,
  getConversation,
  deleteConversation,
  chat,
  listMemories,
  createMemory,
  deleteMemory,
} from '../controllers/aiController.js';

const router = Router();

router.get('/status', asyncHandler(getStatus));
router.get('/settings', asyncHandler(getSettings));
router.put('/settings', asyncHandler(saveSettings));

router.post('/chat', asyncHandler(chat));
router.get('/conversations', asyncHandler(listConversations));
router.get('/conversations/:id', asyncHandler(getConversation));
router.delete('/conversations/:id', asyncHandler(deleteConversation));

router.get('/memories', asyncHandler(listMemories));
router.post('/memories', asyncHandler(createMemory));
router.delete('/memories/:id', asyncHandler(deleteMemory));

export default router;
