const Donation = require('../models/Donation');
const Reservation = require('../models/Reservation');
const { calculateDistance, calculateTravelTime, isValidCoordinate } = require('../utils/geolocation');
const NotificationService = require('../services/notificationService'); // Import notification service

/**
 * @desc    Create a new donation
 * @route   POST /api/donations
 * @access  Private (Donors only)
 */
exports.createDonation = async (req, res) => {
  try {
    const {
      foodType,
      foodDescription,
      quantity,
      location,
      pickupWindow,
      safetyChecklist,
      isRecurring,
      eventMode
    } = req.body;

    // Validation
    if (!foodType || !foodDescription || !quantity || !location || !pickupWindow) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (!isValidCoordinate(location.coordinates.lat, location.coordinates.lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates provided'
      });
    }

    const pickupStart = new Date(pickupWindow.start);
    if (pickupStart <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Pickup window must be in the future'
      });
    }

    // Create donation
    const donation = await Donation.create({
      donor: req.user._id,
      foodType,
      foodDescription: foodDescription.trim(),
      quantity,
      location,
      pickupWindow: {
        start: new Date(pickupWindow.start),
        end: new Date(pickupWindow.end)
      },
      safetyChecklist: safetyChecklist || {},
      isRecurring: isRecurring || false,
      eventMode: eventMode || { isEvent: false },
      status: 'pending'
    });

    await donation.populate('donor', 'name organizationName phone city avatar');

    // Send notification to nearby receivers about new donation
    await NotificationService.notifyNewDonation(
      donation._id,
      donation.location.city,
      donation.foodType
    );

    res.status(201).json({
      success: true,
      message: 'Donation posted successfully!',
      donation
    });

  } catch (error) {
    console.error('Donation creation error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get donor's donations with filtering and pagination
 * @route   GET /api/donations/my-donations
 * @access  Private (Donors only)
 */
exports.getMyDonations = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = { donor: req.user._id };
    if (status) query.status = status;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const donations = await Donation.find(query)
      .populate('reservedBy', 'name organizationName phone avatar')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Donation.countDocuments(query);

    res.json({
      success: true,
      count: donations.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      donations
    });

  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching donations'
    });
  }
};

/**
 * @desc    Get single donation by ID
 * @route   GET /api/donations/:id
 * @access  Private
 */
exports.getDonation = async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate('donor', 'name organizationName phone city avatar rating')
      .populate('reservedBy', 'name organizationName phone avatar');

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    // Authorization check
    const isDonor = donation.donor._id.toString() === req.user._id.toString();
    const isReservedByUser = donation.reservedBy && donation.reservedBy._id.toString() === req.user._id.toString();

    if (!isDonor && !isReservedByUser && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this donation'
      });
    }

    res.json({
      success: true,
      donation
    });

  } catch (error) {
    console.error('Get donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching donation'
    });
  }
};

/**
 * @desc    Update donation
 * @route   PUT /api/donations/:id
 * @access  Private (Donors only)
 */
exports.updateDonation = async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    if (donation.donor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this donation'
      });
    }

    if (donation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update donation that is already reserved or completed'
      });
    }

    const updates = req.body;

    // Validate coordinates if provided
    if (updates.location && updates.location.coordinates) {
      if (!isValidCoordinate(updates.location.coordinates.lat, updates.location.coordinates.lng)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates provided'
        });
      }
    }

    // Convert dates if provided
    if (updates.pickupWindow) {
      updates.pickupWindow.start = new Date(updates.pickupWindow.start);
      updates.pickupWindow.end = new Date(updates.pickupWindow.end);
    }

    const updatedDonation = await Donation.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('donor', 'name organizationName phone city avatar')
      .populate('reservedBy', 'name organizationName phone avatar');

    res.json({
      success: true,
      message: 'Donation updated successfully',
      donation: updatedDonation
    });

  } catch (error) {
    console.error('Update donation error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Delete donation
 * @route   DELETE /api/donations/:id
 * @access  Private (Donors only)
 */
exports.deleteDonation = async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    if (donation.donor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this donation'
      });
    }

    if (donation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete donation that is already reserved or completed'
      });
    }

    await Donation.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Donation deleted successfully'
    });

  } catch (error) {
    console.error('Delete donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting donation'
    });
  }
};

/**
 * @desc    Get nearby available donations
 * @route   GET /api/donations/nearby/available
 * @access  Private (Receivers only)
 */
exports.getNearbyDonations = async (req, res) => {
  try {
    const {
      lat,
      lng,
      maxDistance = 20,
      foodType,
      city,
      page = 1,
      limit = 10
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your current location (lat and lng)'
      });
    }

    if (!isValidCoordinate(parseFloat(lat), parseFloat(lng))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates provided'
      });
    }

    // Use $geoWithin instead of $near to allow sorting by other fields (like createdAt)
    const query = {
      status: 'pending',
      'location.coordinates': {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            maxDistance / 6378.1 // Convert km to radians (Earth radius ~6378.1km)
          ]
        }
      }
    };

    if (foodType) query.foodType = foodType;
    if (city) query['location.city'] = new RegExp(city, 'i');

    const donations = await Donation.find(query)
      .populate('donor', 'name organizationName phone city avatar rating')
      .sort({ createdAt: -1 }) // Now we can sort by date!
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Donation.countDocuments(query);

    const donationsWithDistance = donations.map(donation => {
      const distance = calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        donation.location.coordinates.lat,
        donation.location.coordinates.lng
      );

      return {
        ...donation.toObject(),
        distance,
        estimatedTravelTime: calculateTravelTime(distance)
      };
    });

    res.json({
      success: true,
      count: donationsWithDistance.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      donations: donationsWithDistance
    });

  } catch (error) {
    console.error('Nearby donations error:', error);
    res.status(500).json({
      success: false,
      message: `Error fetching nearby donations: ${error.message}`
    });
  }
};

/**
 * @desc    Search donations with filters
 * @route   GET /api/donations/search/available
 * @access  Private (Receivers only)
 */
exports.searchDonations = async (req, res) => {
  try {
    const {
      city,
      foodType,
      maxDistance = 20,
      lat,
      lng,
      page = 1,
      limit = 10
    } = req.query;

    const query = { status: 'pending' };

    if (city) {
      query['location.city'] = new RegExp(city, 'i');
    }

    if (foodType) {
      query.foodType = foodType;
    }

    if (lat && lng && isValidCoordinate(parseFloat(lat), parseFloat(lng))) {
      // Use $geoWithin here too for consistency if we want to sort by date
      query['location.coordinates'] = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            maxDistance / 6378.1
          ]
        }
      };
    }

    let donationQuery = Donation.find(query)
      .populate('donor', 'name organizationName phone city avatar rating');

    // Always sort by date (newest first) since we are using $geoWithin
    donationQuery = donationQuery.sort({ createdAt: -1 });

    const donations = await donationQuery
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Donation.countDocuments(query);

    let donationsWithDistance = donations;
    if (lat && lng) {
      donationsWithDistance = donations.map(donation => {
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          donation.location.coordinates.lat,
          donation.location.coordinates.lng
        );

        return {
          ...donation.toObject(),
          distance,
          estimatedTravelTime: calculateTravelTime(distance)
        };
      });
    }

    res.json({
      success: true,
      count: donationsWithDistance.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      donations: donationsWithDistance
    });

  } catch (error) {
    console.error('Search donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching donations'
    });
  }
};

/**
 * @desc    Get receiver's reserved donations
 * @route   GET /api/donations/my-reserved-donations
 * @access  Private (Receivers only)
 */
exports.getMyReservedDonations = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const donations = await Donation.find({
      reservedBy: req.user._id,
      status: { $in: ['reserved', 'picked_up'] }
    })
      .populate('donor', 'name organizationName phone city avatar')
      .sort({ reservedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Donation.countDocuments({
      reservedBy: req.user._id,
      status: { $in: ['reserved', 'picked_up'] }
    });

    res.json({
      success: true,
      count: donations.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      donations
    });

  } catch (error) {
    console.error('Get reserved donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reserved donations'
    });
  }
};

/**
 * @desc    Cancel reservation
 * @route   PATCH /api/donations/:id/cancel-reservation
 * @access  Private
 */
exports.cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userType = req.user.userType;

    const donation = await Donation.findById(id);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    // Authorization checks
    if (userType === 'receiver') {
      if (donation.reservedBy.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to cancel this reservation'
        });
      }
    } else if (userType === 'donor') {
      if (donation.donor.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to cancel reservation for this donation'
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (donation.status !== 'reserved') {
      return res.status(400).json({
        success: false,
        message: 'Donation is not reserved'
      });
    }

    // Find and update the reservation
    const reservation = await Reservation.findOne({
      donation: id,
      status: 'confirmed'
    });

    if (reservation) {
      reservation.status = 'cancelled';
      await reservation.save();
    }

    // Update donation status
    donation.status = 'pending';
    donation.reservedBy = undefined;
    donation.reservedAt = undefined;
    await donation.save();

    res.json({
      success: true,
      message: 'Reservation cancelled successfully',
      donation
    });

  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling reservation'
    });
  }
};