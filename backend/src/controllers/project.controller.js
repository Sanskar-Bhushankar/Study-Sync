const projectService = require('../services/project.service');
const { requireFields, requireOneOf } = require('../utils/validators');

async function create(req, res, next) {
  try {
    requireFields(req.body, ['title']);
    const data = await projectService.create(req.body.title, req.body.description, req.user.id);
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function list(req, res, next) {
  try {
    const data = await projectService.listByUser(req.user.id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await projectService.getById(req.params.projectId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    requireOneOf(req.body, ['title', 'description']);
    const data = await projectService.update(req.params.projectId, req.body);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    await projectService.remove(req.params.projectId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

async function getMembers(req, res, next) {
  try {
    const data = await projectService.getMembers(req.params.projectId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function removeMember(req, res, next) {
  try {
    await projectService.removeMember(req.params.projectId, req.params.userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { create, list, getById, update, remove, getMembers, removeMember };
