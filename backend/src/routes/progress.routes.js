const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progress.controller');
const authenticate = require('../middleware/authenticate');
const isMember = require('../middleware/isMember');

router.use(authenticate);
router.post('/projects/:projectId/subtopics/:subtopicId/complete', isMember, progressController.complete);
router.delete('/projects/:projectId/subtopics/:subtopicId/complete', isMember, progressController.uncomplete);
router.post('/projects/:projectId/topics/:topicId/progress/mark-all', isMember, progressController.markAll);
router.patch('/projects/:projectId/subtopics/:subtopicId/note', isMember, progressController.updateNote);
router.get('/projects/:projectId/progress', isMember, progressController.getProgress);
router.get('/projects/:projectId/progress/me', isMember, progressController.getMyProgress);
router.get('/projects/:projectId/progress/:userId', isMember, progressController.getUserProgress);

module.exports = router;
