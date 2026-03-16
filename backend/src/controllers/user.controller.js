const userService = require('../services/user.service');
const { requireOneOf } = require('../utils/validators');

async function getMe(req, res, next) {
  try {
    const data = await userService.getProfile(req.user.id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function updateMe(req, res, next) {
  try {
    requireOneOf(req.body, ['full_name', 'avatar_url']);
    const data = await userService.updateProfile(req.user.id, req.body);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function getInvites(req, res, next) {
  try {
    const data = await userService.getPendingInvites(req.user.email);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

module.exports = { getMe, updateMe, getInvites };
