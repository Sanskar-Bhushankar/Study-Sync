const googleCalendar = require('../services/googleCalendar.service');
const { BadRequestError } = require('../utils/errors');

async function getConnectUrl(req, res, next) {
  try {
    const url = googleCalendar.buildAuthUrl(req.user.id);
    res.json({ success: true, url });
  } catch (e) {
    next(e);
  }
}

async function callback(req, res) {
  try {
    const { code, state, error } = req.query;
    const frontend = googleCalendar.FRONTEND_URL;
    if (error) {
      return res.redirect(`${frontend}/calendar?error=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return res.redirect(`${frontend}/calendar?error=missing_code`);
    }
    await googleCalendar.handleOAuthCallback(code, state);
    res.redirect(`${frontend}/calendar?connected=1`);
  } catch (e) {
    const msg = encodeURIComponent(e.message || 'oauth_failed');
    res.redirect(`${googleCalendar.FRONTEND_URL}/calendar?error=${msg}`);
  }
}

async function status(req, res, next) {
  try {
    const data = await googleCalendar.getStatus(req.user.id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function disconnect(req, res, next) {
  try {
    await googleCalendar.disconnect(req.user.id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

async function getSettings(req, res, next) {
  try {
    const data = await googleCalendar.getSettings(req.user.id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function patchSettings(req, res, next) {
  try {
    const data = await googleCalendar.updateSettings(req.user.id, req.body || {});
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function getLog(req, res, next) {
  try {
    const data = await googleCalendar.getSyncLog(req.user.id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function sync(req, res, next) {
  try {
    const data = await googleCalendar.manualSync(req.user.id, req.body || {});
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function syncAll(req, res, next) {
  try {
    const data = await googleCalendar.syncAllPending(req.user.id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

module.exports = { getConnectUrl, callback, status, disconnect, getSettings, patchSettings, getLog, sync, syncAll };
