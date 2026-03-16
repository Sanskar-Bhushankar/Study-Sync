const dashboardService = require('../services/dashboard.service');
const { NotFoundError } = require('../utils/errors');

async function getDashboard(req, res, next) {
  try {
    const data = await dashboardService.getDashboard(req.params.projectId);
    if (!data) return next(new NotFoundError('Project not found'));
    res.json({ success: true, ...data });
  } catch (e) {
    next(e);
  }
}

async function getSummary(req, res, next) {
  try {
    const data = await dashboardService.getSummary(req.params.projectId);
    if (!data) return next(new NotFoundError('Project not found'));
    res.json({ success: true, ...data });
  } catch (e) {
    next(e);
  }
}

async function getTimeline(req, res, next) {
  try {
    const data = await dashboardService.getTimeline(req.params.projectId);
    res.json({ success: true, timeline: data });
  } catch (e) {
    next(e);
  }
}

module.exports = { getDashboard, getSummary, getTimeline };
