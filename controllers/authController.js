const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { verifyGoogleToken } = require('../utils/googleAuth');
const NotificationService = require('../services/notificationService');
const { sendVerificationOTP, sendPasswordResetOTP } = require('../utils/emailService');

// Register user
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      profileCompleted: false,
      authMethod: 'email',
      emailVerified: false // Email not verified initially
    });

    // Generate OTP
    const otp = user.generateOTP();
    await user.save();

    // Send verification email
    try {
      await sendVerificationOTP(email, name, otp);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but log it
    }

    // Don't send token yet - user must verify email first
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification OTP.',
      requiresVerification: true,
      email: user.email,
      userId: user._id
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Complete profile
const completeProfile = async (req, res) => {
  try {
    const {
      userType,
      phone,
      city,
      organizationName,
      organizationType,
      registrationNumber,
      serviceAreas
    } = req.body;

    if (!userType || !['donor', 'receiver'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid user type (donor or receiver)'
      });
    }

    if (userType === 'donor') {
      if (!organizationName || !organizationType || !phone || !city) {
        return res.status(400).json({
          success: false,
          message: 'For donors, organization name, organization type, phone and city are required'
        });
      }
    }

    if (userType === 'receiver') {
      if (!organizationName || !registrationNumber || !phone || !city) {
        return res.status(400).json({
          success: false,
          message: 'For receivers, organization name, registration number, phone and city are required'
        });
      }
    }

    const updateData = {
      userType,
      phone,
      city,
      organizationName,
      profileCompleted: true
    };

    if (userType === 'donor') {
      updateData.organizationType = organizationType;
    } else {
      updateData.registrationNumber = registrationNumber;
      updateData.serviceAreas = serviceAreas;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    // Send profile completion notification
    await NotificationService.notifyProfileCompleted(user._id);

    res.json({
      success: true,
      message: 'Profile completed successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        profileCompleted: user.profileCompleted,
        phone: user.phone,
        city: user.city,
        profilePicture: user.profilePicture,
        organizationName: user.organizationName,
        ...(user.userType === 'donor' && {
          organizationType: user.organizationType
        }),
        ...(user.userType === 'receiver' && {
          registrationNumber: user.registrationNumber,
          serviceAreas: user.serviceAreas
        }),
        verificationDocument: user.verificationDocument,
        verificationStatus: user.verificationStatus
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/// Update existing profile
const updateProfile = async (req, res) => {
  try {
    const {
      userType,
      name,
      phone,
      address,
      city,
      organizationType,
      organizationName,
      registrationNumber,
      serviceAreas,
      profilePicture,
      verificationDocument,
      verificationStatus
    } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (city) user.city = city;
    if (organizationName) user.organizationName = organizationName;
    if (organizationType) user.organizationType = organizationType;
    if (registrationNumber) user.registrationNumber = registrationNumber;
    if (serviceAreas) user.serviceAreas = serviceAreas;
    if (userType) {
      user.userType = userType;
      user.profileCompleted = true;
    }
    if (profilePicture) user.profilePicture = profilePicture;
    if (req.body.hasOwnProperty('verificationDocument')) {
      user.verificationDocument = verificationDocument;
    }
    if (req.body.hasOwnProperty('verificationStatus')) {
      user.verificationStatus = verificationStatus;
    }
    await user.save();
    res.json({
      success: true,
      message: 'Profile updated',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        profileCompleted: user.profileCompleted,
        authMethod: user.authMethod,
        phone: user.phone,
        city: user.city,
        address: user.address,
        avatar: user.avatar,
        profilePicture: user.profilePicture,
        organizationName: user.organizationName,
        ...(user.userType === 'donor' && {
          organizationType: user.organizationType
        }),
        ...(user.userType === 'receiver' && {
          registrationNumber: user.registrationNumber,
          serviceAreas: user.serviceAreas
        }),
        verificationDocument: user.verificationDocument,
        verificationStatus: user.verificationStatus
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user uses Google auth
    if (user.authMethod === 'google') {
      return res.status(401).json({
        success: false,
        message: 'This account uses Google authentication. Please sign in with Google.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email to login',
        requiresVerification: true,
        email: user.email
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        profileCompleted: user.profileCompleted,
        authMethod: user.authMethod,
        profilePicture: user.profilePicture,
        organizationName: user.organizationName,
        ...(user.userType === 'donor' && {
          organizationType: user.organizationType
        }),
        ...(user.userType === 'receiver' && {
          registrationNumber: user.registrationNumber
        }),
        verificationDocument: user.verificationDocument,
        verificationStatus: user.verificationStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Google authentication
const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required'
      });
    }

    const verification = await verifyGoogleToken(idToken);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    const { user: googleUser } = verification;
    const { googleId, email, name, picture } = googleUser;

    let user = await User.findOne({
      $or: [
        { googleId: googleId },
        { email: email.toLowerCase() }
      ]
    });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        user.authMethod = 'google';
        user.avatar = picture;
        user.emailVerified = true;
        await user.save();
      }
    } else {
      user = await User.create({
        name: name,
        email: email.toLowerCase(),
        googleId: googleId,
        authMethod: 'google',
        avatar: picture,
        emailVerified: true,
        profileCompleted: false
      });

      // Send welcome notification to new Google user
      await NotificationService.sendWelcomeNotification(user._id, user.name);
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Google authentication successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        profileCompleted: user.profileCompleted,
        authMethod: user.authMethod,
        avatar: user.avatar,
        profilePicture: user.profilePicture,
        ...(user.profileCompleted && {
          organizationName: user.organizationName,
          phone: user.phone,
          city: user.city,
          ...(user.userType === 'donor' && {
            organizationType: user.organizationType
          }),
          ...(user.userType === 'receiver' && {
            registrationNumber: user.registrationNumber,
            serviceAreas: user.serviceAreas
          })
        }),
        verificationDocument: user.verificationDocument,
        verificationStatus: user.verificationStatus
      }
    });

  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during Google authentication'
    });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        profileCompleted: user.profileCompleted,
        authMethod: user.authMethod,
        phone: user.phone,
        city: user.city,
        address: user.address,
        avatar: user.avatar,
        profilePicture: user.profilePicture,
        organizationName: user.organizationName,
        ...(user.userType === 'donor' && {
          organizationType: user.organizationType
        }),
        ...(user.userType === 'receiver' && {
          registrationNumber: user.registrationNumber,
          serviceAreas: user.serviceAreas
        }),
        verificationDocument: user.verificationDocument,
        verificationStatus: user.verificationStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Check email
const checkEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({
        success: true,
        exists: false,
        message: 'Email not registered'
      });
    }

    res.json({
      success: true,
      exists: true,
      authMethod: user.authMethod,
      profileCompleted: user.profileCompleted,
      message: `User exists with ${user.authMethod} authentication`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get profile status
const getProfileStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      profileCompleted: user.profileCompleted,
      userType: user.userType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
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