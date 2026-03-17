const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topic.controller');
const authenticate = require('../middleware/authenticate');
const isMember = require('../middleware/isMember');
const isOwner = require('../middleware/isOwner');

router.use(authenticate);
router.post('/projects/:projectId/topics/bulk', isMember, isOwner, topicController.bulkCreate);
router.post('/projects/:projectId/topics', isMember, isOwner, topicController.create);
router.get('/projects/:projectId/topics', isMember, topicController.list);
router.patch('/projects/:projectId/topics/reorder', isMember, isOwner, topicController.reorder);
router.patch('/projects/:projectId/topics/:topicId', isMember, isOwner, topicController.update);
router.delete('/projects/:projectId/topics/:topicId', isMember, isOwner, topicController.remove);

module.exports = router;
