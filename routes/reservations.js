const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    createReservation,
    getMyReservations,
    getReservationById,
    updateReservationStatus,
    updatePickupProof,
    submitRating,
    getReservations
} = require('../controllers/reservationController');

router.use(protect);

// Reservation routes
router.get('/', getReservations); // New route for fetching with filters
router.post('/', authorize('receiver'), createReservation);
router.get('/my-reservations', getMyReservations);
router.get('/:id', getReservationById);
router.patch('/:id/status', updateReservationStatus);
router.patch('/:id/pickup-proof', authorize('receiver'), updatePickupProof);
router.patch('/:id/rating', submitRating); // Removed authorize('receiver') to allow donors

module.exports = router;