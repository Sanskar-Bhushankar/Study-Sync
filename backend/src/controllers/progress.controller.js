const progressService = require('../services/progress.service');
const { NotFoundError } = require('../utils/errors');

async function complete(req, res, next) {
  try {
    const data = await progressService.markComplete(req.params.projectId, req.params.subtopicId, req.user.id);
    if (!data) return next(new NotFoundError('Subtopic not found'));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

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

module.exports = { complete, uncomplete, getProgress, getMyProgress, getUserProgress };
