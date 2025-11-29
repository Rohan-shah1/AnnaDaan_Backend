const express = require('express');
const { protect } = require('../middleware/auth');
const {
  register,
  completeProfile,
  login,
  googleAuth,
  getMe,
  checkEmail,
  getProfileStatus,
  updateProfile,
  verifyEmail,
  resendVerificationOTP,
  forgotPassword,
  verifyPasswordResetOTP,
  resetPassword
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
router.patch('/profile', protect, updateProfile);

// Email verification routes
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendVerificationOTP);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyPasswordResetOTP);
router.post('/reset-password', resetPassword);

module.exports = router;