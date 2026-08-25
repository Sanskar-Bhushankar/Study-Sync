const progressService = require('../services/progress.service');
const { NotFoundError } = require('../utils/errors');

async function complete(req, res, next) {
  try {
    const data = await progressService.markComplete(req.params.projectId, req.params.subtopicId, req.user.id);
    if (!data) return next(new NotFoundError('Subtopic not found'));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function markAll(req, res, next) {
  try {
    const { projectId, topicId } = req.params;
    const data = await progressService.markAllComplete(projectId, topicId, req.user.id);
    notifyStreakMayHaveChanged();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function updateNote(req, res, next) {
  try {
    const { projectId, subtopicId } = req.params;
    const { note } = req.body || {};
    const data = await progressService.updatePersonalNote(projectId, subtopicId, req.user.id, note);
    if (!data) return next(new NotFoundError('Subtopic not found'));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

// Helper imported lazily to avoid circular deps
function notifyStreakMayHaveChanged() { /* streak refresh happens on frontend via STREAK_REFRESH_EVENT */ }

async function uncomplete(req, res, next) {
  try {
    const data = await progressService.unmarkComplete(req.params.projectId, req.params.subtopicId, req.user.id);
    if (!data) return next(new NotFoundError('Subtopic not found'));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function getProgress(req, res, next) {
  try {
    const data = await progressService.getProgressMatrix(req.params.projectId);
    res.json({ success: true, ...data });
  } catch (e) {
    next(e);
  }
}

async function getMyProgress(req, res, next) {
  try {
    const data = await progressService.getProgressForUser(req.params.projectId, req.user.id);
    res.json({ success: true, ...data });
  } catch (e) {
    next(e);
  }
}

async function getUserProgress(req, res, next) {
  try {
    const data = await progressService.getProgressForUser(req.params.projectId, req.params.userId);
    res.json({ success: true, ...data });
  } catch (e) {
    next(e);
  }
}

module.exports = { complete, uncomplete, getProgress, getMyProgress, getUserProgress, markAll, updateNote };
