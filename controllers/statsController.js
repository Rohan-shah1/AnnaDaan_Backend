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
        const userRole = req.user.role;

        let stats = {};

        if (userRole === 'donor') {
            // Donor statistics
            const totalDonations = await Donation.countDocuments({ donor: userId });
            const activeDonations = await Donation.countDocuments({
                donor: userId,
                status: { $in: ['AVAILABLE', 'RESERVED'] }
            });
            const completedDonations = await Donation.countDocuments({
                donor: userId,
                status: 'COMPLETED'
            });

            // Calculate total impact (sum of quantities from completed donations)
            const impactResult = await Donation.aggregate([
                {
                    $match: {
                        donor: userId,
                        status: 'COMPLETED'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalQuantity: { $sum: 1 }, // Count of donations
                        totalMeals: { $sum: { $toDouble: '$quantity' } } // Assuming quantity can be parsed to number
                    }
                }
            ]);

            const impact = impactResult.length > 0 ? impactResult[0] : { totalQuantity: 0, totalMeals: 0 };

            // Calculate rating (based on completed reservations feedback if available)
            // For now, return a placeholder rating
            const rating = 4.8; // TODO: Implement actual rating calculation from reservation feedback

            stats = {
                role: 'donor',
                totalDonations,
                activeDonations,
                completedDonations,
                impact: {
                    totalDonations: completedDonations,
                    estimatedMeals: Math.round(completedDonations * 50), // Estimate 50 meals per donation
                    peopleHelped: Math.round(completedDonations * 25), // Estimate 25 people per donation
                },
                rating: rating
            };

        } else if (userRole === 'receiver') {
            // Receiver statistics
            const totalReservations = await Reservation.countDocuments({ receiver: userId });
            const activeReservations = await Reservation.countDocuments({
                receiver: userId,
                status: { $in: ['PENDING', 'ACCEPTED'] }
            });
            const completedReservations = await Reservation.countDocuments({
                receiver: userId,
                status: { $in: ['PICKED_UP', 'COMPLETED'] }
            });

            // Calculate total food collected
            const foodCollected = await Reservation.aggregate([
                {
                    $match: {
                        receiver: userId,
                        status: { $in: ['PICKED_UP', 'COMPLETED'] }
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

            // Calculate rating
            const rating = 5.0; // TODO: Implement actual rating calculation

            stats = {
                role: 'receiver',
                totalReservations,
                activeReservations,
                completedReservations,
                impact: {
                    foodCollected: `${collected} pickups`,
                    mealsServed: collected * 60, // Estimate 60 meals per pickup
                    peopleHelped: collected * 30, // Estimate 30 people per pickup
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
        const userRole = req.user.role;

        let impactMetrics = {};

        if (userRole === 'donor') {
            // Donor impact metrics
            const donations = await Donation.find({
                donor: userId,
                status: 'COMPLETED'
            }).select('quantity createdAt foodType');

            const totalDonations = donations.length;
            const estimatedMeals = totalDonations * 50; // 50 meals per donation average
            const peopleHelped = Math.round(totalDonations * 25); // 25 people per donation
            const foodSaved = `${totalDonations * 15}kg`; // 15kg per donation average

            // Calculate monthly trend
            const thisMonth = new Date();
            thisMonth.setDate(1);
            thisMonth.setHours(0, 0, 0, 0);

            const thisMonthDonations = donations.filter(d => new Date(d.createdAt) >= thisMonth).length;

            impactMetrics = {
                totalDonations,
                estimatedMeals,
                peopleHelped,
                foodSaved,
                thisMonth: thisMonthDonations,
                trend: thisMonthDonations > 0 ? 'up' : 'stable'
            };

        } else if (userRole === 'receiver') {
            // Receiver impact metrics
            const reservations = await Reservation.find({
                receiver: userId,
                status: { $in: ['PICKED_UP', 'COMPLETED'] }
            }).populate('donation', 'quantity foodType createdAt');

            const totalPickups = reservations.length;
            const mealsServed = totalPickups * 60; // 60 meals per pickup average
            const peopleHelped = totalPickups * 30; // 30 people per pickup
            const foodCollected = `${totalPickups * 20}kg`; // 20kg per pickup average

            // Calculate monthly trend
            const thisMonth = new Date();
            thisMonth.setDate(1);
            thisMonth.setHours(0, 0, 0, 0);

            const thisMonthPickups = reservations.filter(r =>
                new Date(r.createdAt) >= thisMonth
            ).length;

            impactMetrics = {
                totalPickups,
                mealsServed,
                peopleHelped,
                foodCollected,
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
        const userRole = req.user.role;

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
