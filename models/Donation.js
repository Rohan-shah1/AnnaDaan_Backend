const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Food details
  foodType: {
    type: String,
    required: [true, 'Food type is required'],
    enum: ['cooked_veg', 'cooked_non_veg', 'packaged_meals', 'raw_vegetables']
  },
  foodDescription: {
    type: String,
    required: [true, 'Food description is required'],
    trim: true
  },
  foodImage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files'
  },
  quantity: {
    value: {
      type: Number,
      required: [true, 'Quantity value is required'],
      min: 1
    },
    unit: {
      type: String,
      enum: ['kg', 'portions', 'boxes', 'crates'],
      default: 'kg'
    }
  },

  // Exact location with coordinates (from Google Maps)
  location: {
    address: {
      type: String,
      required: [true, 'Address is required']
    },
    coordinates: {
      lat: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: -90,
        max: 90
      },
      lng: {
        type: Number,
        required: [true, 'Longitude is required'],
        min: -180,
        max: 180
      }
    },
    city: {
      type: String,
      required: [true, 'City is required']
    }
  },

  // Pickup details
  pickupWindow: {
    start: {
      type: Date,
      required: [true, 'Pickup start time is required']
    },
    end: {
      type: Date,
      required: [true, 'Pickup end time is required']
    }
  },

  // Status and tracking
  status: {
    type: String,
    enum: ['pending', 'reserved', 'picked_up', 'completed', 'cancelled', 'expired'],
    default: 'pending'
  },

  // Safety checklist
  safetyChecklist: {
    temperatureChecked: Boolean,
    properlyPackaged: Boolean,
    labeled: Boolean,
    vegNonVegSegregated: Boolean,
    timestamp: Date
  },

  // Special modes
  isRecurring: {
    type: Boolean,
    default: false
  },
  eventMode: {
    isEvent: Boolean,
    eventName: String,
    totalGuests: Number
  },

  // Reservation info
  reservedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reservedAt: Date,
  pickedUpAt: Date

}, {
  timestamps: true
});

// 2dsphere index for geospatial queries
donationSchema.index({ 'location.coordinates': '2dsphere' });

// Method to calculate distance to a point
donationSchema.methods.calculateDistance = function (lat, lng) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat - this.location.coordinates.lat) * Math.PI / 180;
  const dLng = (lng - this.location.coordinates.lng) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.location.coordinates.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
};

module.exports = mongoose.model('Donation', donationSchema);