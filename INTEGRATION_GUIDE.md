# Email Verification & Reset Password - Integration Guide

## ✅ What's Already Done
1. ✅ User schema updated with OTP fields (`User.js`)
2. ✅ Email service created (`utils/emailService.js`)  
3. ✅ SMTP credentials added to `.env`

## 📝 Step 1: Update Auth Controller

**File**: `controllers/authController.js`

Add this import at the top (line 5):
```javascript
const { sendVerificationOTP, sendPasswordResetOTP } = require('../utils/emailService');
```

Add these 5 new functions BEFORE `module.exports` (you can add them after `getProfileStatus` function):

```javascript
// Verify email with OTP
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }
    const user = await User.findOne({ email }).select('+otp +otpExpiry');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.emailVerified) {
      return res.json({ success: true, message: 'Email already verified', alreadyVerified: true });
    }
    if (!user.verifyOTP(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    user.emailVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();
    const token = generateToken(user._id);
    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        profileCompleted: user.profileCompleted,
        authMethod: user.authMethod
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Resend verification OTP
const resendVerificationOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.emailVerified) {
      return res.json({ success: true, message: 'Email already verified' });
    }
    const otp = user.generateOTP();
    await user.save();
    await sendVerificationOTP(email, user.name, otp);
    res.json({ success: true, message: 'Verification OTP sent to your email' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: true, message: 'If your email is registered, you will receive a password reset OTP' });
    }
    if (user.authMethod === 'google') {
      return res.status(400).json({ success: false, message: 'This account uses Google authentication. Password reset is not available.' });
    }
    if (!user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first before resetting password' });
    }
    const otp = user.generatePasswordResetOTP();
    await user.save();
    await sendPasswordResetOTP(email, user.name, otp);
    res.json({ success: true, message: 'Password reset OTP sent to your email' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify password reset OTP
const verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordResetOtp +passwordResetOtpExpiry');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.verifyPasswordResetOTP(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    res.json({ success: true, message: 'OTP verified successfully. You can now reset your password.', resetToken: otp });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordResetOtp +passwordResetOtpExpiry');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.verifyPasswordResetOTP(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    user.password = newPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpiry = undefined;
    await user.save();
    res.json({ success: true, message: 'Password reset successfully. You can now login with your new password.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

Update `module.exports` to include new functions:
```javascript
module.exports = {
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
};
```

## 📝 Step 2: Update Auth Routes

**File**: `routes/auth.js`

Update imports (lines 3-12):
```javascript
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
```

Add new routes (after line 19):
```javascript
// Email verification routes
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendVerificationOTP);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyPasswordResetOTP);
router.post('/reset-password', resetPassword);
```

## 🎯 API Endpoints Now Available

1. `POST /auth/verify-email` - Verify email with OTP
2. `POST /auth/resend-otp` - Resend verification OTP
3. `POST /auth/forgot-password` - Request password reset
4. `POST /auth/verify-reset-otp` - Verify password reset OTP
5. `POST /auth/reset-password` - Reset password

## ✅ Backend Complete!

The backend is now ready. Test with Postman or implement the Flutter frontend next.
