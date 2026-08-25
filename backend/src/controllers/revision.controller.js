const revisionService = require('../services/revision.service');
const { requireFields } = require('../utils/validators');

async function logRevision(req, res, next) {
  try {
    const { projectId, topicId } = req.params;
    const { note } = req.body || {};
    const data = await revisionService.logRevision(projectId, topicId, req.user.id, note);
    res.status(201).json({ data });
  } catch (e) { next(e); }
}

async function listRevisions(req, res, next) {
  try {
    const { projectId, topicId } = req.params;
    const data = await revisionService.listRevisions(projectId, topicId, req.user.id);
    res.json({ data });
  } catch (e) { next(e); }
}

async function listProjectRevisions(req, res, next) {
  try {
    const { projectId } = req.params;
    const data = await revisionService.listProjectRevisions(projectId, req.user.id);
    res.json({ data });
  } catch (e) { next(e); }
}

async function deleteRevision(req, res, next) {
  try {
    const { projectId, revisionId } = req.params;
    await revisionService.deleteRevision(projectId, revisionId, req.user.id);
    res.status(204).send();
  } catch (e) { next(e); }
}

module.exports = { logRevision, listRevisions, listProjectRevisions, deleteRevision };
