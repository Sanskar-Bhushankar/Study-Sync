const completionService = require('../services/completion.service');

async function complete(req, res, next) {
  try {
    const data = await completionService.completeTopic(req.params.projectId, req.params.topicId, req.user.id, req.file);
    res.status(201).json({ success: true, data });
  } catch (e) {
    console.error('[complete] Error:', JSON.stringify(e, null, 2), e.message, e.stack);
    next(e);
  }
}

async function listCompletions(req, res, next) {
  try {
    const data = await completionService.listCompletions(req.params.projectId, req.params.topicId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

async function getNotesUrl(req, res, next) {
  try {
    const signedUrl = await completionService.getNotesSignedUrl(req.params.projectId, req.params.topicId, req.params.userId);
    res.json({ success: true, signed_url: signedUrl });
  } catch (e) {
    next(e);
  }
}

async function getMyCompletions(req, res, next) {
  try {
    const data = await completionService.getMyCompletions(req.params.projectId, req.user.id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

module.exports = { complete, listCompletions, getNotesUrl, getMyCompletions };
