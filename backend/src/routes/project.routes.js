const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const authenticate = require('../middleware/authenticate');
const isMember = require('../middleware/isMember');
const isOwner = require('../middleware/isOwner');

router.use(authenticate);
router.post('/', projectController.create);
router.get('/', projectController.list);
router.get('/:projectId', isMember, projectController.getById);
router.patch('/:projectId', isMember, isOwner, projectController.update);
router.delete('/:projectId', isMember, isOwner, projectController.remove);
router.get('/:projectId/members', isMember, projectController.getMembers);
router.delete('/:projectId/members/:userId', isMember, isOwner, projectController.removeMember);
router.patch('/:projectId/pin', isMember, projectController.togglePin);

module.exports = router;
