const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    getDashboardStats,
    getPendingVerifications,
    verifyUser,
    getAllUsers,
    deleteUser
} = require('../controllers/adminController');

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/pending-verifications', getPendingVerifications);
router.put('/verify/:userId', verifyUser);
router.get('/users', getAllUsers);
router.delete('/users/:userId', deleteUser);

module.exports = router;
