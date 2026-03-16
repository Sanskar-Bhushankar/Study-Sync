const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/authenticate');
const isMember = require('../middleware/isMember');

router.use(authenticate);
router.get('/projects/:projectId/dashboard', isMember, dashboardController.getDashboard);
router.get('/projects/:projectId/dashboard/summary', isMember, dashboardController.getSummary);
router.get('/projects/:projectId/dashboard/timeline', isMember, dashboardController.getTimeline);

module.exports = router;
