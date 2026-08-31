import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  listTaggingRules,
  createTaggingRule,
  updateTaggingRule,
  deleteTaggingRule,
  runAutoTagger,
  approveSuggestion,
  getSessionReview,
  getPreMarketBriefing,
  getRiskAlert,
  getPerformancePatterns,
} from '../controllers/agentsController.js';

const router = Router();

// Agent 1 — Auto Trade Tagger
router.get('/tagging-rules', asyncHandler(listTaggingRules));
router.post('/tagging-rules', asyncHandler(createTaggingRule));
router.put('/tagging-rules/:id', asyncHandler(updateTaggingRule));
router.delete('/tagging-rules/:id', asyncHandler(deleteTaggingRule));
router.post('/auto-tagger/run', asyncHandler(runAutoTagger));
router.post('/auto-tagger/approve', asyncHandler(approveSuggestion));

// Agent 2 — Session Review
router.get('/session-review', asyncHandler(getSessionReview));

// Agent 3 — Pre-Market Briefing
router.get('/pre-market', asyncHandler(getPreMarketBriefing));

// Agent 4 — Risk Monitor
router.get('/risk-monitor', asyncHandler(getRiskAlert));

// Agent 5 — Performance Patterns
router.get('/performance-patterns', asyncHandler(getPerformancePatterns));

export default router;
