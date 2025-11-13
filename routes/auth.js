const express = require('express');
const { protect } = require('../middleware/auth');
const {
  register,
  completeProfile,
  login,
  googleAuth,
  getMe,
  checkEmail,
  getProfileStatus
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/check-email', checkEmail);

// Protected routes
router.put('/profile', protect, completeProfile);
router.get('/me', protect, getMe);
router.get('/profile/status', protect, getProfileStatus);

module.exports = router;