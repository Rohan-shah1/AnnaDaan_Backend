const express = require('express');
const {
  registerFCMToken,
  removeFCMToken,
  updateNotificationPreferences,
  sendTestNotification
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All notification routes require authentication
router.use(protect);

// Register FCM token for push notifications
router.post('/register-token', registerFCMToken);

// Remove FCM token
router.post('/remove-token', removeFCMToken);

// Update notification preferences
router.put('/preferences', updateNotificationPreferences);

// Send test notification
router.post('/test', sendTestNotification);

module.exports = router;