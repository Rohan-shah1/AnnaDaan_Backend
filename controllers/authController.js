const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { verifyGoogleToken } = require('../utils/googleAuth');
const NotificationService = require('../services/notificationService'); // Import notification service

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
      authMethod: 'email'
    });

    const token = generateToken(user._id);

    // Send welcome notification to new user
    await NotificationService.sendWelcomeNotification(user._id, user.name);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please complete your profile.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileCompleted: user.profileCompleted,
        userType: user.userType,
        authMethod: user.authMethod
      }
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
        organizationName: user.organizationName,
        ...(user.userType === 'donor' && {
          organizationType: user.organizationType
        }),
        ...(user.userType === 'receiver' && {
          registrationNumber: user.registrationNumber,
          serviceAreas: user.serviceAreas
        })
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
// Update existing profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone, address, city, organizationType, organizationName } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (city) user.city = city;
    if (organizationName) user.organizationName = organizationName;
    if (organizationType) user.organizationType = organizationType;

    await user.save();
    res.json({ success: true, message: 'Profile updated', user });
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
        organizationName: user.organizationName,
        ...(user.userType === 'donor' && {
          organizationType: user.organizationType
        }),
        ...(user.userType === 'receiver' && {
          registrationNumber: user.registrationNumber
        })
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
        })
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
        avatar: user.avatar,
        organizationName: user.organizationName,
        ...(user.userType === 'donor' && {
          organizationType: user.organizationType
        }),
        ...(user.userType === 'receiver' && {
          registrationNumber: user.registrationNumber,
          serviceAreas: user.serviceAreas
        })
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

module.exports = {
  register,
  completeProfile,
  login,
  googleAuth,
  getMe,
  checkEmail,
  getProfileStatus,
  updateProfile
};