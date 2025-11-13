const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  createDonation,
  getMyDonations,
  getDonation,
  updateDonation,
  deleteDonation,
  getNearbyDonations,
  searchDonations
} = require('../controllers/donationController');

const router = express.Router();

// Donor routes
router.post('/', protect, authorize('donor'), createDonation);
router.get('/my-donations', protect, authorize('donor'), getMyDonations);
router.put('/:id', protect, authorize('donor'), updateDonation);
router.delete('/:id', protect, authorize('donor'), deleteDonation);

// Receiver routes
router.get('/nearby/available', protect, authorize('receiver'), getNearbyDonations);
router.get('/search/available', protect, authorize('receiver'), searchDonations);

// Common routes
router.get('/:id', protect, getDonation);

module.exports = router;