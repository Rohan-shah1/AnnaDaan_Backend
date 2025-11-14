const Reservation = require('../models/Reservation');
const Donation = require('../models/Donation');
const User = require('../models/User');
const { calculateDistance, calculateTravelTime } = require('../utils/geolocation');
const NotificationService = require('../services/notificationService'); // Import notification service

/**
 * @desc    Create a reservation
 * @route   POST /api/reservations
 * @access  Private (Receivers only)
 */
exports.createReservation = async (req, res) => {
  try {
    const { donationId, scheduledPickup } = req.body;
    const receiverId = req.user._id;

    // Validation
    if (!donationId || !scheduledPickup) {
      return res.status(400).json({
        success: false,
        message: 'Donation ID and scheduled pickup time are required'
      });
    }

    // Check donation availability
    const donation = await Donation.findById(donationId);
    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    if (donation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Donation is already ${donation.status}`
      });
    }

    // Check if receiver is trying to reserve their own donation
    if (donation.donor.toString() === receiverId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reserve your own donation'
      });
    }

    // Check for existing reservation
    const existingReservation = await Reservation.findOne({
      donation: donationId,
      receiver: receiverId,
      status: { $in: ['confirmed', 'scheduled'] }
    });

    if (existingReservation) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active reservation for this donation'
      });
    }

    // Calculate distance and travel time
    const receiver = await User.findById(receiverId);
    const receiverLocation = {
      lat: 27.7172, // Default - update with user's actual location
      lng: 85.3240
    };

    const distance = calculateDistance(
      receiverLocation.lat,
      receiverLocation.lng,
      donation.location.coordinates.lat,
      donation.location.coordinates.lng
    );

    const estimatedTravelTime = calculateTravelTime(distance);

    // Create reservation
    const reservation = await Reservation.create({
      donation: donationId,
      receiver: receiverId,
      scheduledPickup: new Date(scheduledPickup),
      distance: distance,
      estimatedTravelTime: estimatedTravelTime,
      status: 'confirmed'
    });

    // Update donation status
    donation.status = 'reserved';
    donation.reservedBy = receiverId;
    donation.reservedAt = new Date();
    await donation.save();

    // Populate reservation data for notifications
    await reservation.populate('donation', 'foodType foodDescription quantity location pickupWindow donor');
    await reservation.populate('receiver', 'name organizationName phone city');
    await reservation.populate('donor', 'name organizationName phone city');

    // Send notifications to donor and receiver
    await NotificationService.notifyDonationReserved(
      donationId,
      donation.donor.toString(),
      req.user.organizationName
    );

    await NotificationService.notifyReservationConfirmed(
      reservation._id,
      receiverId,
      donation.donor.organizationName
    );

    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      reservation
    });

  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating reservation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get current user's reservations
 * @route   GET /api/reservations/my-reservations
 * @access  Private
 */
exports.getMyReservations = async (req, res) => {
  try {
    const userId = req.user._id;
    const userType = req.user.userType;
    const { status, page = 1, limit = 10 } = req.query;

    let query = {};
    let populateOptions = [];

    if (userType === 'receiver') {
      query.receiver = userId;
      populateOptions = [
        { path: 'donation', select: 'foodType foodDescription quantity location pickupWindow status donor' },
        { path: 'donor', select: 'name organizationName phone city avatar' }
      ];
    } else if (userType === 'donor') {
      // Get reservations for donor's donations
      const donorDonations = await Donation.find({ donor: userId }).select('_id');
      const donationIds = donorDonations.map(donation => donation._id);
      
      query.donation = { $in: donationIds };
      populateOptions = [
        { path: 'donation', select: 'foodType foodDescription quantity location pickupWindow status' },
        { path: 'receiver', select: 'name organizationName phone city avatar rating totalPickups' }
      ];
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type for reservations'
      });
    }

    if (status) {
      query.status = status;
    }

    const reservations = await Reservation.find(query)
      .populate(populateOptions)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Reservation.countDocuments(query);

    res.json({
      success: true,
      count: reservations.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      reservations
    });

  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reservations'
    });
  }
};

/**
 * @desc    Update reservation status
 * @route   PATCH /api/reservations/:id/status
 * @access  Private
 */
exports.updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user._id;
    const userType = req.user.userType;

    // Validate status
    const validStatuses = ['confirmed', 'scheduled', 'picked_up', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find reservation
    const reservation = await Reservation.findById(id)
      .populate('donation')
      .populate('receiver');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Authorization check
    const isDonor = reservation.donation.donor.toString() === userId.toString();
    const isReceiver = reservation.receiver._id.toString() === userId.toString();

    if (!isDonor && !isReceiver) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this reservation'
      });
    }

    // Status transition validation
    if (status === 'cancelled') {
      if (!isReceiver && !isDonor) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to cancel this reservation'
        });
      }

      // Update donation status back to pending
      reservation.donation.status = 'pending';
      reservation.donation.reservedBy = undefined;
      reservation.donation.reservedAt = undefined;
      await reservation.donation.save();
    }

    if (status === 'picked_up') {
      if (!isReceiver) {
        return res.status(403).json({
          success: false,
          message: 'Only receiver can mark reservation as picked up'
        });
      }
      
      // Update donation status
      reservation.donation.status = 'picked_up';
      reservation.donation.pickedUpAt = new Date();
      await reservation.donation.save();

      // Update receiver's pickup count
      await User.findByIdAndUpdate(userId, {
        $inc: { totalPickups: 1 }
      });

      // Send notification to donor that donation was picked up
      await NotificationService.notifyDonationPickedUp(
        reservation.donation._id,
        reservation.donation.donor.toString(),
        reservation.receiver.organizationName
      );
    }

    // Update reservation
    reservation.status = status;
    
    if (status === 'picked_up') {
      reservation.actualPickup = new Date();
    }

    await reservation.save();

    // Populate before response
    await reservation.populate('donation', 'foodType foodDescription quantity location pickupWindow');
    await reservation.populate('receiver', 'name organizationName phone city');
    await reservation.populate('donor', 'name organizationName phone city');

    res.json({
      success: true,
      message: `Reservation ${status} successfully`,
      reservation
    });

  } catch (error) {
    console.error('Update reservation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating reservation status'
    });
  }
};

/**
 * @desc    Update proof of pickup
 * @route   PATCH /api/reservations/:id/pickup-proof
 * @access  Private (Receiver only)
 */
exports.updatePickupProof = async (req, res) => {
  try {
    const { id } = req.params;
    const { photos, temperatureAtPickup, notes } = req.body;
    const userId = req.user._id;

    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Authorization check
    if (reservation.receiver.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update pickup proof for this reservation'
      });
    }

    if (reservation.status !== 'picked_up') {
      return res.status(400).json({
        success: false,
        message: 'Can only add pickup proof for completed pickups'
      });
    }

    // Update pickup proof
    reservation.proofOfPickup = {
      photos: photos || [],
      temperatureAtPickup: temperatureAtPickup || null,
      notes: notes || '',
      completedAt: new Date()
    };

    await reservation.save();

    // Populate before response
    await reservation.populate('donation', 'foodType foodDescription quantity');
    await reservation.populate('receiver', 'name organizationName');
    await reservation.populate('donor', 'name organizationName');

    res.json({
      success: true,
      message: 'Pickup proof updated successfully',
      reservation
    });

  } catch (error) {
    console.error('Update pickup proof error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating pickup proof'
    });
  }
};

/**
 * @desc    Get reservation by ID
 * @route   GET /api/reservations/:id
 * @access  Private
 */
exports.getReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const reservation = await Reservation.findById(id)
      .populate('donation', 'foodType foodDescription quantity location pickupWindow donor')
      .populate('receiver', 'name organizationName phone city rating totalPickups')
      .populate('donor', 'name organizationName phone city');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Authorization check
    const isDonor = reservation.donation.donor.toString() === userId.toString();
    const isReceiver = reservation.receiver._id.toString() === userId.toString();

    if (!isDonor && !isReceiver) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this reservation'
      });
    }

    res.json({
      success: true,
      reservation
    });

  } catch (error) {
    console.error('Get reservation by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reservation'
    });
  }
};