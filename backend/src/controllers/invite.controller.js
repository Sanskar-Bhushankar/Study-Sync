const inviteService = require('../services/invite.service');
const { requireFields } = require('../utils/validators');

async function create(req, res, next) {
  try {
    requireFields(req.body, ['invited_email']);
    const data = await inviteService.create(req.params.projectId, req.body.invited_email, req.user.id);
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function list(req, res, next) {
  try {
    const data = await inviteService.listByProject(req.params.projectId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function cancel(req, res, next) {
  try {
    await inviteService.cancel(req.params.projectId, req.params.inviteId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

async function accept(req, res, next) {
  try {
    const data = await inviteService.accept(req.params.inviteId, req.user.email, req.user.id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function decline(req, res, next) {
  try {
    await inviteService.decline(req.params.inviteId, req.user.email);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { create, list, cancel, accept, decline };
