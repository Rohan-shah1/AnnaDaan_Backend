const Donation = require('../models/Donation');
const Reservation = require('../models/Reservation');

/**
 * @desc    Get dashboard statistics for the authenticated user
 * @route   GET /api/stats/dashboard
 * @access  Private
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.userType;

        let stats = {};

        if (userRole === 'donor') {
            // Donor statistics
            const totalDonations = await Donation.countDocuments({ donor: userId });
            const activeDonations = await Donation.countDocuments({
                donor: userId,
                status: { $in: ['pending', 'reserved'] }
            });
            const completedDonations = await Donation.countDocuments({
                donor: userId,
                status: { $in: ['completed', 'picked_up'] }
            });

            // Calculate total impact (sum of quantities from completed donations)
            const impactResult = await Donation.aggregate([
                {
                    $match: {
                        donor: userId,
                        status: { $in: ['completed', 'picked_up'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalQuantity: { $sum: 1 }, // Count of donations
                        totalMeals: { $sum: { $toDouble: '$quantity.value' } } // Use quantity.value
                    }
                }
            ]);

            const impact = impactResult.length > 0 ? impactResult[0] : { totalQuantity: 0, totalMeals: 0 };

            // Calculate rating (based on completed reservations feedback)
            const ratingResult = await Reservation.aggregate([
                {
                    $lookup: {
                        from: 'donations',
                        localField: 'donation',
                        foreignField: '_id',
                        as: 'donationDetails'
                    }
                },
                {
                    $unwind: '$donationDetails'
                },
                {
                    $match: {
                        'donationDetails.donor': userId,
                        'status': { $in: ['picked_up', 'completed'] },
                        'rating': { $exists: true, $ne: null }
                    }
                },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: '$rating' }
                    }
                }
            ]);

            const rating = ratingResult.length > 0
                ? parseFloat(ratingResult[0].averageRating.toFixed(1))
                : 0.0;

            // Calculate actual impact from quantities
            const completedDonationsData = await Donation.find({
                donor: userId,
                status: { $in: ['completed', 'picked_up'] }
            }).select('quantity');

            let totalMeals = 0;
            let totalPeople = 0;
            let totalKg = 0;

            completedDonationsData.forEach(don => {
                const qty = don.quantity;
                if (qty && qty.value) {
                    const value = parseFloat(qty.value);
                    const unit = (qty.unit || '').toLowerCase();

                    if (unit === 'portions') {
                        totalMeals += value;
                        totalPeople += value;
                        totalKg += value * 0.75; // 20 portions = 15kg, so 1 portion = 0.75kg
                    } else if (unit === 'crates' || unit === 'boxes') {
                        totalMeals += value * 26;
                        totalPeople += value * 26;
                        totalKg += value * 20;
                    }
                }
            });

            stats = {
                role: 'donor',
                totalDonations,
                activeDonations,
                completedDonations,
                impact: {
                    totalDonations: completedDonations,
                    estimatedMeals: Math.round(totalMeals),
                    peopleHelped: Math.round(totalPeople),
                    foodSaved: `${Math.round(totalKg)}kg`
                },
                rating: rating
            };

        } else if (userRole === 'receiver') {
            // Receiver statistics
            const totalReservations = await Reservation.countDocuments({ receiver: userId });
            const activeReservations = await Reservation.countDocuments({
                receiver: userId,
                status: { $in: ['confirmed', 'scheduled'] }
            });
            const completedReservations = await Reservation.countDocuments({
                receiver: userId,
                status: { $in: ['picked_up', 'completed'] }
            });

            // Calculate total food collected
            const foodCollected = await Reservation.aggregate([
                {
                    $match: {
                        receiver: userId,
                        status: { $in: ['picked_up', 'completed'] }
                    }
                },
                {
                    $lookup: {
                        from: 'donations',
                        localField: 'donation',
                        foreignField: '_id',
                        as: 'donationDetails'
                    }
                },
                {
                    $unwind: '$donationDetails'
                },
                {
                    $group: {
                        _id: null,
                        totalCount: { $sum: 1 }
                    }
                }
            ]);

            const collected = foodCollected.length > 0 ? foodCollected[0].totalCount : 0;

            // Calculate actual impact from quantities
            const reservationsWithDonations = await Reservation.find({
                receiver: userId,
                status: { $in: ['picked_up', 'completed'] }
            }).populate('donation', 'quantity');

            let totalMeals = 0;
            let totalPeople = 0;
            let totalKg = 0;

            reservationsWithDonations.forEach(res => {
                const qty = res.donation?.quantity;
                if (qty && qty.value) {
                    const value = parseFloat(qty.value);
                    const unit = (qty.unit || '').toLowerCase();

                    if (unit === 'portions') {
                        totalMeals += value;
                        totalPeople += value;
                        totalKg += value * 0.75;
                    } else if (unit === 'crates' || unit === 'boxes') {
                        totalMeals += value * 26;
                        totalPeople += value * 26;
                        totalKg += value * 20;
                    }
                }
            });

            // Calculate rating (based on donor ratings)
            const ratingResult = await Reservation.aggregate([
                {
                    $match: {
                        receiver: userId,
                        status: { $in: ['picked_up', 'completed'] },
                        donorRating: { $exists: true, $ne: null }
                    }
                },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: '$donorRating' }
                    }
                }
            ]);

            const rating = ratingResult.length > 0
                ? parseFloat(ratingResult[0].averageRating.toFixed(1))
                : 0.0;

            stats = {
                role: 'receiver',
                totalReservations,
                activeReservations,
                completedReservations,
                impact: {
                    foodCollected: `${collected} pickups`,
                    mealsServed: Math.round(totalMeals),
                    peopleHelped: Math.round(totalPeople),
                    foodCollectedKg: `${Math.round(totalKg)}kg`
                },
                rating: rating
            };
        }

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
};

/**
 * @desc    Get impact metrics for the authenticated user
 * @route   GET /api/stats/impact
 * @access  Private
 */
exports.getImpactMetrics = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.userType;

        let impactMetrics = {};

        if (userRole === 'donor') {
            // Donor impact metrics
            const donations = await Donation.find({
                donor: userId,
                status: { $in: ['completed', 'picked_up'] }
            }).select('quantity createdAt foodType');

            const totalDonations = donations.length;

            // Calculate actual impact from quantities
            let totalMeals = 0;
            let totalPeople = 0;
            let totalKg = 0;

            donations.forEach(don => {
                const qty = don.quantity;
                if (qty && qty.value) {
                    const value = parseFloat(qty.value);
                    const unit = (qty.unit || '').toLowerCase();

                    if (unit === 'portions') {
                        totalMeals += value;
                        totalPeople += value;
                        totalKg += value * 0.75;
                    } else if (unit === 'crates' || unit === 'boxes') {
                        totalMeals += value * 26;
                        totalPeople += value * 26;
                        totalKg += value * 20;
                    }
                }
            });

            // Calculate monthly trend
            const thisMonth = new Date();
            thisMonth.setDate(1);
            thisMonth.setHours(0, 0, 0, 0);

            const thisMonthDonations = donations.filter(d => new Date(d.createdAt) >= thisMonth).length;

            impactMetrics = {
                totalDonations,
                estimatedMeals: Math.round(totalMeals),
                peopleHelped: Math.round(totalPeople),
                foodSaved: `${Math.round(totalKg)}kg`,
                thisMonth: thisMonthDonations,
                trend: thisMonthDonations > 0 ? 'up' : 'stable'
            };

        } else if (userRole === 'receiver') {
            // Receiver impact metrics
            const reservations = await Reservation.find({
                receiver: userId,
                status: { $in: ['picked_up', 'completed'] }
            }).populate('donation', 'quantity foodType createdAt');

            const totalPickups = reservations.length;

            // Calculate actual impact from quantities
            let totalMeals = 0;
            let totalPeople = 0;
            let totalKg = 0;

            reservations.forEach(res => {
                const qty = res.donation?.quantity;
                if (qty && qty.value) {
                    const value = parseFloat(qty.value);
                    const unit = (qty.unit || '').toLowerCase();

                    if (unit === 'portions') {
                        totalMeals += value;
                        totalPeople += value;
                        totalKg += value * 0.75;
                    } else if (unit === 'crates' || unit === 'boxes') {
                        totalMeals += value * 26;
                        totalPeople += value * 26;
                        totalKg += value * 20;
                    }
                }
            });

            // Calculate monthly trend
            const thisMonth = new Date();
            thisMonth.setDate(1);
            thisMonth.setHours(0, 0, 0, 0);

            const thisMonthPickups = reservations.filter(r =>
                new Date(r.createdAt) >= thisMonth
            ).length;

            impactMetrics = {
                pickupsDone: totalPickups,
                estimatedMeals: Math.round(totalMeals),
                peopleHelped: Math.round(totalPeople),
                foodCollected: `${Math.round(totalKg)}kg`,
                thisMonth: thisMonthPickups,
                trend: thisMonthPickups > 0 ? 'up' : 'stable'
            };
        }

        res.json({
            success: true,
            data: impactMetrics
        });
    } catch (error) {
        console.error('Error fetching impact metrics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching impact metrics',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
};

/**
 * @desc    Get user rating and feedback summary
 * @route   GET /api/stats/rating
 * @access  Private
 */
exports.getUserRating = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.userType;

        // For now, return mock rating data
        // TODO: Implement actual rating system with reservation feedback
        const ratingData = {
            overallRating: 4.8,
            totalRatings: 24,
            breakdown: {
                5: 18,
                4: 5,
                3: 1,
                2: 0,
                1: 0
            },
            recentFeedback: []
        };

        res.json({
            success: true,
            data: ratingData
        });
    } catch (error) {
        console.error('Error fetching rating:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching rating',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
};
