import Playbook from '../models/Playbook.js';
import Trade from '../models/Trade.js';
import { getPerformanceFor } from '../services/performanceService.js';

export async function listPlaybooks(req, res) {
  const playbooks = await Playbook.find().sort({ setupName: 1 }).lean();
  res.json(playbooks);
}

export async function getPlaybook(req, res) {
  const playbook = await Playbook.findById(req.params.id).lean();
  if (!playbook) {
    res.status(404);
    throw new Error('Playbook not found');
  }
  res.json(playbook);
}

export async function createPlaybook(req, res) {
  const playbook = await Playbook.create(req.body);
  res.status(201).json(playbook);
}

export async function updatePlaybook(req, res) {
  const playbook = await Playbook.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!playbook) {
    res.status(404);
    throw new Error('Playbook not found');
  }
  res.json(playbook);
}

export async function deletePlaybook(req, res) {
  const inUse = await Trade.countDocuments({ playbook: req.params.id });
  if (inUse > 0) {
    res.status(409);
    throw new Error(`Cannot delete: ${inUse} trade(s) are assigned to this playbook. Reassign or bulk-edit them first.`);
  }
  const deleted = await Playbook.findByIdAndDelete(req.params.id);
  if (!deleted) {
    res.status(404);
    throw new Error('Playbook not found');
  }
  res.status(204).send();
}

export async function getPlaybookPerformance(req, res) {
  const playbook = await Playbook.findById(req.params.id).lean();
  if (!playbook) {
    res.status(404);
    throw new Error('Playbook not found');
  }
  const performance = await getPerformanceFor('playbook', req.params.id);
  res.json(performance);
}

export default {
  listPlaybooks,
  getPlaybook,
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
  getPlaybookPerformance,
};
