const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);
router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.get('/me/invites', userController.getInvites);
router.get('/me/profile', userController.getProfileActivity);
router.get('/me/stats', userController.getStats);

module.exports = router;
