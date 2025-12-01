const User = require('../models/User');

// Get dashboard stats
const getDashboardStats = async (req, res) => {
    try {
        const totalDonors = await User.countDocuments({ userType: 'donor' });
        const totalReceivers = await User.countDocuments({ userType: 'receiver' });
        const pendingVerifications = await User.countDocuments({ verificationStatus: 'pending' });

        // Get verified today count
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const verifiedToday = await User.countDocuments({
            verificationStatus: 'verified',
            updatedAt: { $gte: startOfDay }
        });

        res.json({
            success: true,
            stats: {
                totalDonors,
                totalReceivers,
                pendingVerifications,
                verifiedToday
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get pending verifications
const getPendingVerifications = async (req, res) => {
    try {
        const users = await User.find({ verificationStatus: 'pending' })
            .select('name userType email phone organizationName verificationDocument createdAt')
            .populate('verificationDocument')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Verify or reject user
const verifyUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body; // 'verified' or 'rejected'

        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { verificationStatus: status },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // TODO: Send notification to user about verification status

        res.json({
            success: true,
            message: `User ${status} successfully`,
            user: {
                id: user._id,
                name: user.name,
                verificationStatus: user.verificationStatus
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all users
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, type } = req.query;
        const query = { userType: { $ne: 'admin' } }; // Exclude admin users

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        if (type) {
            query.userType = type;
        }

        const users = await User.find(query)
            .select('-password -otp -otpExpiry')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const count = await User.countDocuments(query);

        res.json({
            success: true,
            users,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalUsers: count
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete user
const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Prevent admin from deleting themselves
        if (userId === req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You cannot delete your own account'
            });
        }

        const user = await User.findByIdAndDelete(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getPendingVerifications,
    verifyUser,
    getAllUsers,
    deleteUser
};
