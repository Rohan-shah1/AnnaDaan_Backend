const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getDashboardStats,
    getImpactMetrics,
    getUserRating
} = require('../controllers/statsController');

// All routes require authentication
router.use(protect);

// @route   GET /api/stats/dashboard
// @desc    Get dashboard statistics
// @access  Private
router.get('/dashboard', getDashboardStats);

// @route   GET /api/stats/impact
// @desc    Get impact metrics
// @access  Private
router.get('/impact', getImpactMetrics);

// @route   GET /api/stats/rating
// @desc    Get user rating
// @access  Private
router.get('/rating', getUserRating);

module.exports = router;
