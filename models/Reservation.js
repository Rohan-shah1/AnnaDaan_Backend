const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  donation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donation',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'picked_up', 'completed', 'cancelled', 'no_show'],
    default: 'confirmed'
  },
  scheduledPickup: {
    type: Date,
    required: true
  },

  // Distance information
  distance: {
    type: Number, // in kilometers
    required: true
  },
  estimatedTravelTime: {
    type: Number, // in minutes
    required: true
  },

  estimatedArrival: Date,
  actualPickup: Date,

  assignedDriver: {
    name: String,
    phone: String,
    vehicle: String
  },

  proofOfPickup: {
    photos: [String],
    receiverSignature: String,
    temperatureAtPickup: Number,
    notes: String
  },

  // Rating and Feedback
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Reservation', reservationSchema);