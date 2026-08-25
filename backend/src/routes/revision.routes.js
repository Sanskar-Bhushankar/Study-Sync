const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const isMember = require('../middleware/isMember');
const revisionController = require('../controllers/revision.controller');

// All revision routes require auth + project membership
router.post(
  '/projects/:projectId/topics/:topicId/revisions',
  authenticate, isMember,
  revisionController.logRevision
);

router.get(
  '/projects/:projectId/topics/:topicId/revisions',
  authenticate, isMember,
  revisionController.listRevisions
);

router.get(
  '/projects/:projectId/revisions',
  authenticate, isMember,
  revisionController.listProjectRevisions
);

router.delete(
  '/projects/:projectId/revisions/:revisionId',
  authenticate, isMember,
  revisionController.deleteRevision
);

module.exports = router;
