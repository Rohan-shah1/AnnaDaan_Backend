const express = require('express');
const {
  createReservation,
  getMyReservations,
  updateReservationStatus,
  updatePickupProof,
  getReservationById
} = require('../controllers/reservationController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Reservation routes
router.post('/', authorize('receiver'), createReservation);
router.get('/my-reservations', getMyReservations);
router.get('/:id', getReservationById);
router.patch('/:id/status', updateReservationStatus);
router.patch('/:id/pickup-proof', authorize('receiver'), updatePickupProof);

module.exports = router;