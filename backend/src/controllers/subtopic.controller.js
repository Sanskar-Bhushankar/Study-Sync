const subtopicService = require('../services/subtopic.service');
const { requireFields, requireOneOf } = require('../utils/validators');

async function create(req, res, next) {
  try {
    requireFields(req.body, ['title']);
    const data = await subtopicService.create(req.params.topicId, req.body.title, req.body.order_index, req.params.projectId);
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    requireOneOf(req.body, ['title', 'order_index']);
    const data = await subtopicService.update(req.params.subtopicId, req.body);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    await subtopicService.remove(req.params.subtopicId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

async function reorder(req, res, next) {
  try {
    const orderMap = req.body.order;
    if (!orderMap || typeof orderMap !== 'object') return next(require('../utils/errors').BadRequestError('order map required'));
    const data = await subtopicService.reorder(req.params.topicId, orderMap);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

module.exports = { create, update, remove, reorder };
