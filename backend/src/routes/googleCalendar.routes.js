const express = require('express');
const router = express.Router();
const googleCalendarController = require('../controllers/googleCalendar.controller');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);
router.get('/integrations/google/connect-url', googleCalendarController.getConnectUrl);
router.get('/integrations/google/status', googleCalendarController.status);
router.delete('/integrations/google/disconnect', googleCalendarController.disconnect);
router.get('/integrations/google/settings', googleCalendarController.getSettings);
router.patch('/integrations/google/settings', googleCalendarController.patchSettings);
router.get('/integrations/google/log', googleCalendarController.getLog);
router.post('/integrations/google/sync', googleCalendarController.sync);
router.post('/integrations/google/sync-all', googleCalendarController.syncAll);

module.exports = router;
