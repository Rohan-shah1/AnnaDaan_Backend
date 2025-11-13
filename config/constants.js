module.exports = {
  USER_TYPES: {
    DONOR: 'donor',
    RECEIVER: 'receiver',
    ADMIN: 'admin'
  },
  
  DONATION_STATUS: {
    PENDING: 'pending',
    RESERVED: 'reserved',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired'
  },
  
  FOOD_CATEGORIES: {
    COOKED_VEG: 'cooked_veg',
    COOKED_NON_VEG: 'cooked_non_veg',
    PACKAGED_MEALS: 'packaged_meals',
    RAW_VEGETABLES: 'raw_vegetables'
  },
  
  PICKUP_WINDOWS: {
    EARLY_MORNING: '6-9',
    MID_DAY: '11-2', 
    EVENING: '4-7',
    LATE_NIGHT: '8-12'
  },
  
  NOTIFICATION_TYPES: {
    NEW_DONATION: 'new_donation',
    RESERVATION_CONFIRMED: 'reservation_confirmed',
    PICKUP_REMINDER: 'pickup_reminder',
    DONATION_COMPLETED: 'donation_completed'
  }
};