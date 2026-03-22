const express = require('express');
const router = express.Router();
const completionController = require('../controllers/completion.controller');
const authenticate = require('../middleware/authenticate');
const isMember = require('../middleware/isMember');
const uploadMiddleware = require('../middleware/uploadMiddleware');

router.use(authenticate);
router.post('/projects/:projectId/topics/:topicId/complete', isMember, uploadMiddleware, completionController.complete);
router.get('/projects/:projectId/topics/:topicId/completions', isMember, completionController.listCompletions);
router.get('/projects/:projectId/topics/:topicId/completions/:userId/notes', isMember, completionController.getNotesUrl);
router.get('/projects/:projectId/completions/all', isMember, completionController.listAllCompletions);
router.get('/projects/:projectId/completions/me', isMember, completionController.getMyCompletions);

module.exports = router;
