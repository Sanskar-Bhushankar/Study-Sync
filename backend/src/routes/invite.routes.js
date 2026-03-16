const express = require('express');
const router = express.Router();
const inviteController = require('../controllers/invite.controller');
const authenticate = require('../middleware/authenticate');
const isMember = require('../middleware/isMember');
const isOwner = require('../middleware/isOwner');

router.use(authenticate);
router.post('/projects/:projectId/invites', isMember, isOwner, inviteController.create);
router.get('/projects/:projectId/invites', isMember, isOwner, inviteController.list);
router.delete('/projects/:projectId/invites/:inviteId', isMember, isOwner, inviteController.cancel);
router.post('/invites/:inviteId/accept', inviteController.accept);
router.post('/invites/:inviteId/decline', inviteController.decline);

module.exports = router;
