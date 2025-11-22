const { sendPushNotification, sendBulkNotifications, notificationTemplates } = require('../utils/notifications');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Service class to handle business logic for notifications
class NotificationService {
  // Notify donor when their donation is reserved
  static async notifyDonationReserved(donationId, donorId, receiverName) {
    try {
      const result = await sendPushNotification(
        donorId,
        notificationTemplates.DONATION_RESERVED,
        {
          donationId: donationId.toString(),
          receiverName,
          type: 'donation_update',
          screen: 'donation_details'
        }
      );

      // Save to database
      await Notification.create({
        recipient: donorId,
        title: notificationTemplates.DONATION_RESERVED.title,
        message: notificationTemplates.DONATION_RESERVED.body.replace('{{receiverName}}', receiverName),
        type: 'reservation',
        relatedId: donationId
      });

      console.log(`Donation reserved notification sent to donor: ${donorId}`);
      return result;

    } catch (error) {
      console.error('Error sending donation reserved notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify receiver when reservation is confirmed
  static async notifyReservationConfirmed(reservationId, receiverId, donorName) {
    try {
      const result = await sendPushNotification(
        receiverId,
        notificationTemplates.RESERVATION_CONFIRMED,
        {
          reservationId: reservationId.toString(),
          donorName,
          type: 'reservation_update',
          screen: 'reservation_details'
        }
      );

      // Save to database
      await Notification.create({
        recipient: receiverId,
        title: notificationTemplates.RESERVATION_CONFIRMED.title,
        message: notificationTemplates.RESERVATION_CONFIRMED.body.replace('{{donorName}}', donorName),
        type: 'reservation',
        relatedId: reservationId
      });

      console.log(`Reservation confirmed notification sent to receiver: ${receiverId}`);
      return result;

    } catch (error) {
      console.error('Error sending reservation confirmed notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify donor when donation is picked up
  static async notifyDonationPickedUp(donationId, donorId, receiverName) {
    try {
      const result = await sendPushNotification(
        donorId,
        notificationTemplates.DONATION_PICKED_UP,
        {
          donationId: donationId.toString(),
          receiverName,
          type: 'donation_update',
          screen: 'donation_details'
        }
      );

      // Save to database
      await Notification.create({
        recipient: donorId,
        title: notificationTemplates.DONATION_PICKED_UP.title,
        message: notificationTemplates.DONATION_PICKED_UP.body.replace('{{receiverName}}', receiverName),
        type: 'completion',
        relatedId: donationId
      });

      console.log(`Donation picked up notification sent to donor: ${donorId}`);
      return result;

    } catch (error) {
      console.error('Error sending donation picked up notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send welcome notification to new users
  static async sendWelcomeNotification(userId, userName) {
    try {
      const result = await sendPushNotification(
        userId,
        notificationTemplates.WELCOME,
        {
          userName,
          type: 'welcome',
          screen: 'profile'
        }
      );

      // Save to database
      await Notification.create({
        recipient: userId,
        title: notificationTemplates.WELCOME.title,
        message: notificationTemplates.WELCOME.body.replace('{{userName}}', userName),
        type: 'system'
      });

      console.log(`Welcome notification sent to user: ${userId}`);
      return result;

    } catch (error) {
      console.error('Error sending welcome notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify user when profile is completed
  static async notifyProfileCompleted(userId) {
    try {
      const result = await sendPushNotification(
        userId,
        notificationTemplates.PROFILE_COMPLETED,
        {
          type: 'profile_completed',
          screen: 'home'
        }
      );

      // Save to database
      await Notification.create({
        recipient: userId,
        title: notificationTemplates.PROFILE_COMPLETED.title,
        message: notificationTemplates.PROFILE_COMPLETED.body,
        type: 'system'
      });

      console.log(`Profile completion notification sent to user: ${userId}`);
      return result;

    } catch (error) {
      console.error('Error sending profile completion notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify user when profile is approved (for future admin approval system)
  static async notifyProfileApproved(userId) {
    try {
      const result = await sendPushNotification(
        userId,
        notificationTemplates.PROFILE_APPROVED,
        {
          type: 'profile_approved',
          screen: 'home'
        }
      );

      // Save to database
      await Notification.create({
        recipient: userId,
        title: notificationTemplates.PROFILE_APPROVED.title,
        message: notificationTemplates.PROFILE_APPROVED.body,
        type: 'system'
      });

      console.log(`Profile approved notification sent to user: ${userId}`);
      return result;

    } catch (error) {
      console.error('Error sending profile approved notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify nearby receivers about new donation
  static async notifyNewDonation(donationId, city, foodType) {
    try {
      // Find receivers in the same city who want new donation notifications
      const receivers = await User.find({
        userType: 'receiver',
        'notificationPreferences.newDonations': true,
        city: new RegExp(city, 'i'),
        fcmTokens: { $exists: true, $ne: [] }
      });

      const receiverIds = receivers.map(receiver => receiver._id);

      if (receiverIds.length === 0) {
        console.log(`No receivers to notify about new donation in ${city}`);
        return { success: true, sentCount: 0 };
      }

      const notification = {
        title: 'New Donation Available!',
        body: `New ${foodType} donation available in ${city}. Check it out!`
      };

      const data = {
        donationId: donationId.toString(),
        city,
        foodType,
        type: 'new_donation',
        screen: 'donations_nearby'
      };

      // Send to all qualified receivers
      const results = await Promise.all(
        receiverIds.map(receiverId =>
          sendPushNotification(receiverId, notification, data)
        )
      );

      // Save to database for each receiver
      const notificationsToSave = receiverIds.map(receiverId => ({
        recipient: receiverId,
        title: notification.title,
        message: notification.body,
        type: 'alert',
        relatedId: donationId
      }));

      if (notificationsToSave.length > 0) {
        await Notification.insertMany(notificationsToSave);
      }

      const totalSent = results.reduce((sum, result) => sum + (result.sentCount || 0), 0);

      console.log(`New donation notification sent to ${totalSent} receivers in ${city}`);
      return { success: true, totalSent, totalReceivers: receiverIds.length };

    } catch (error) {
      console.error('Error sending new donation notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // Send pickup reminder to receiver
  static async sendPickupReminder(reservationId, receiverId, pickupTime) {
    try {
      const formattedTime = new Date(pickupTime).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit'
      });

      const notification = {
        title: 'Pickup Reminder',
        body: `Don't forget! Your donation pickup is scheduled for ${formattedTime}`
      };

      const result = await sendPushNotification(
        receiverId,
        notification,
        {
          reservationId: reservationId.toString(),
          pickupTime: pickupTime.toISOString(),
          type: 'reminder',
          screen: 'reservation_details'
        }
      );

      // Save to database
      await Notification.create({
        recipient: receiverId,
        title: notification.title,
        message: notification.body,
        type: 'reminder',
        relatedId: reservationId
      });

      console.log(`Pickup reminder sent to receiver: ${receiverId}`);
      return result;

    } catch (error) {
      console.error('Error sending pickup reminder:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificationService;