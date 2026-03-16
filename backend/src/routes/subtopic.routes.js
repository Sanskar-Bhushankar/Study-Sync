const express = require('express');
const router = express.Router();
const subtopicController = require('../controllers/subtopic.controller');
const authenticate = require('../middleware/authenticate');
const isMember = require('../middleware/isMember');
const isOwner = require('../middleware/isOwner');

router.use(authenticate);
router.post('/projects/:projectId/topics/:topicId/subtopics', isMember, isOwner, subtopicController.create);
router.patch('/projects/:projectId/topics/:topicId/subtopics/reorder', isMember, isOwner, subtopicController.reorder);
router.patch('/projects/:projectId/topics/:topicId/subtopics/:subtopicId', isMember, isOwner, subtopicController.update);
router.delete('/projects/:projectId/topics/:topicId/subtopics/:subtopicId', isMember, isOwner, subtopicController.remove);

module.exports = router;
