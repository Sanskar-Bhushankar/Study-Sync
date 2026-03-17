const topicService = require('../services/topic.service');
const { requireFields, requireOneOf } = require('../utils/validators');

async function create(req, res, next) {
  try {
    requireFields(req.body, ['title']);
    const data = await topicService.create(req.params.projectId, req.body.title, req.body.order_index);
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function list(req, res, next) {
  try {
    const data = await topicService.listByProject(req.params.projectId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    requireOneOf(req.body, ['title', 'order_index']);
    const data = await topicService.update(req.params.topicId, req.body);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    await topicService.remove(req.params.topicId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

async function reorder(req, res, next) {
  try {
    const orderMap = req.body.order;
    if (!orderMap || typeof orderMap !== 'object') return next(require('../utils/errors').BadRequestError('order map required'));
    const data = await topicService.reorder(req.params.projectId, orderMap);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function bulkCreate(req, res, next) {
  try {
    const { topics } = req.body;
    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'topics array required' } });
    }
    const data = await topicService.bulkCreate(req.params.projectId, topics);
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

module.exports = { create, list, update, remove, reorder, bulkCreate };
