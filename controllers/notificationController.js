
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPushNotification, notificationTemplates } = require('../utils/notifications');

// Register FCM token for push notifications
const registerFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user._id;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    // Add token to user's FCM tokens array (avoid duplicates with $addToSet)
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { fcmTokens: fcmToken } },
      { new: true }
    );

    console.log(`FCM token registered for user: ${userId} `);

    res.json({
      success: true,
      message: 'FCM token registered successfully'
    });

  } catch (error) {
    console.error('Register FCM token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering FCM token'
    });
  }
};

// Remove FCM token when user logs out or uninstalls app
const removeFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user._id;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    await User.findByIdAndUpdate(
      userId,
      { $pull: { fcmTokens: fcmToken } }
    );

    console.log(`FCM token removed for user: ${userId} `);

    res.json({
      success: true,
      message: 'FCM token removed successfully'
    });

  } catch (error) {
    console.error('Remove FCM token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing FCM token'
    });
  }
};

// Update user's notification preferences
const updateNotificationPreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    const userId = req.user._id;

    // Update user's notification preferences
    const user = await User.findByIdAndUpdate(
      userId,
      {
        notificationPreferences: {
          ...req.user.notificationPreferences,
          ...preferences
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: user.notificationPreferences
    });

  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification preferences'
    });
  }
};

// Send test notification to current user
const sendTestNotification = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await sendPushNotification(
      userId,
      {
        title: 'Test Notification',
        body: 'This is a test notification from AnnaDaan!'
      },
      {
        type: 'test',
        screen: 'home'
      }
    );

    if (result.success) {
      res.json({
        success: true,
        message: `Test notification sent to ${result.sentCount} device(s)`
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('Send test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test notification'
    });
  }
};

// Get user notifications
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    });
  }
};

// Mark notification as read
const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification'
    });
  }
};

module.exports = {
  registerFCMToken,
  removeFCMToken,
  updateNotificationPreferences,
  sendTestNotification,
  getNotifications,
  markNotificationRead
};
