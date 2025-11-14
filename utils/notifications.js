const admin = require('../config/firebase');
const User = require('../models/User');

// Send push notification to a specific user
const sendPushNotification = async (userId, notification, data = {}) => {
  try {
    // Get user's FCM tokens and notification preferences
    const user = await User.findById(userId).select('fcmTokens notificationPreferences');
    
    // Check if user has FCM tokens
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`No FCM tokens found for user: ${userId}`);
      return { success: false, message: 'No FCM tokens available' };
    }

    // Check user notification preferences based on notification type
    if (data.type && user.notificationPreferences) {
      const preferenceMapping = {
        'donation_update': 'donationUpdates',
        'reservation_update': 'reservationUpdates',
        'new_donation': 'newDonations',
        'reminder': 'reminders',
        'promotion': 'promotions'
      };
      
      const preferenceKey = preferenceMapping[data.type];
      // Skip notification if user has disabled this type
      if (preferenceKey && !user.notificationPreferences[preferenceKey]) {
        console.log(`User ${userId} has disabled ${preferenceKey} notifications`);
        return { success: false, message: 'Notifications disabled for this type' };
      }
    }

    // Prepare message for Firebase Cloud Messaging
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        image: notification.image || null
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        sound: 'default'
      },
      tokens: user.fcmTokens // Send to all user's devices
    };

    // Send multicast message to multiple devices
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`Notification sent to ${response.successCount} devices for user: ${userId}`);

    // Clean up invalid tokens if any failures occurred
    if (response.failureCount > 0) {
      await cleanupFailedTokens(userId, user.fcmTokens, response.responses);
    }

    return {
      success: true,
      sentCount: response.successCount,
      failedCount: response.failureCount
    };

  } catch (error) {
    console.error('Push notification error:', error);
    return { success: false, error: error.message };
  }
};

// Send notification to multiple users
const sendBulkNotifications = async (userIds, notification, data = {}) => {
  try {
    // Send notifications to all users in parallel
    const results = await Promise.all(
      userIds.map(userId => sendPushNotification(userId, notification, data))
    );

    // Calculate total statistics
    const totalSent = results.reduce((sum, result) => sum + (result.sentCount || 0), 0);
    const totalFailed = results.reduce((sum, result) => sum + (result.failedCount || 0), 0);

    return {
      success: true,
      totalUsers: userIds.length,
      totalSent,
      totalFailed,
      results
    };
  } catch (error) {
    console.error('Bulk notification error:', error);
    return { success: false, error: error.message };
  }
};

// Clean up invalid FCM tokens from user's device list
const cleanupFailedTokens = async (userId, tokens, responses) => {
  const failedTokens = [];
  
  // Identify failed tokens from Firebase responses
  responses.forEach((response, index) => {
    if (!response.success) {
      failedTokens.push(tokens[index]);
    }
  });

  // Remove failed tokens from user's FCM tokens array
  if (failedTokens.length > 0) {
    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: { $in: failedTokens } }
    });
    console.log(`Cleaned up ${failedTokens.length} invalid FCM tokens for user: ${userId}`);
  }
};

// Pre-defined notification templates for different events
const notificationTemplates = {
  // User registration and profile notifications
  WELCOME: {
    title: 'Welcome to AnnaDaan!',
    body: 'Thank you for joining our mission to reduce food waste.',
    type: 'welcome'
  },
  PROFILE_COMPLETED: {
    title: 'Profile Under Review!',
    body: 'Your profile has been submitted and is under verification.',
    type: 'profile_completed'
  },
  PROFILE_APPROVED: {
    title: 'Profile Verified!',
    body: 'Your profile has been approved. You can now start using AnnaDaan.',
    type: 'profile_approved'
  },

  // Donation-related notifications
  DONATION_RESERVED: {
    title: 'Donation Reserved!',
    body: 'Your donation has been reserved by an NGO.',
    type: 'donation_update'
  },
  DONATION_PICKED_UP: {
    title: 'Donation Picked Up!',
    body: 'Your donation has been successfully picked up.',
    type: 'donation_update'
  },
  NEW_DONATION_AVAILABLE: {
    title: 'New Donation Available!',
    body: 'A new donation is available near your location.',
    type: 'new_donation'
  },

  // Reservation-related notifications
  RESERVATION_CONFIRMED: {
    title: 'Reservation Confirmed!',
    body: 'Your reservation has been confirmed.',
    type: 'reservation_update'
  },
  RESERVATION_CANCELLED: {
    title: 'Reservation Cancelled',
    body: 'Your reservation has been cancelled.',
    type: 'reservation_update'
  },
  PICKUP_REMINDER: {
    title: 'Pickup Reminder',
    body: 'Remember to pick up your reserved donation soon!',
    type: 'reminder'
  }
};

module.exports = {
  sendPushNotification,
  sendBulkNotifications,
  notificationTemplates
};