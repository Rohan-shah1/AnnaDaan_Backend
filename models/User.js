// User model with document verification fields
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic registration fields (Step 1)
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function () {
      // Password is required only for email authentication, not Google
      return this.authMethod === 'email';
    },
    minlength: 6
  },

  // Profile completion fields (Step 2)
  userType: {
    type: String,
    enum: ['donor', 'receiver', null],
    default: null
  },
  profileCompleted: {
    type: Boolean,
    default: false
  },

  // Contact information
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },

  // Donor-specific fields
  organizationName: String,
  organizationType: {
    type: String,
    enum: ['restaurant', 'large_vegetable_market', 'party_palace', 'event_venue', 'catering', null],
    default: null
  },

  // Receiver-specific fields (NGO)
  registrationNumber: String,
  serviceAreas: [String],

  // FCM Tokens for push notifications (multiple devices)
  fcmTokens: [{
    type: String,
    select: false // Don't include in queries by default for security
  }],

  // Notification preferences
  notificationPreferences: {
    donationUpdates: { type: Boolean, default: true },
    reservationUpdates: { type: Boolean, default: true },
    newDonations: { type: Boolean, default: true },
    reminders: { type: Boolean, default: true },
    promotions: { type: Boolean, default: false }
  },

  // Google OAuth fields
  googleId: {
    type: String,
    unique: true,
    sparse: true // Allows null for non-Google users
  },
  authMethod: {
    type: String,
    enum: ['email', 'google'],
    default: 'email'
  },
  avatar: String, // Store Google profile picture URL
  profilePicture: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files' // Reference to GridFS uploaded profile picture
  },
  emailVerified: {
    type: Boolean,
    default: false
  },

  // OTP verification fields
  otp: {
    type: String,
    select: false // Don't include in queries by default for security
  },
  otpExpiry: {
    type: Date,
    select: false
  },
  passwordResetOtp: {
    type: String,
    select: false
  },
  passwordResetOtpExpiry: {
    type: Date,
    select: false
  },

  // Document verification fields
  verificationDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files'
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', null],
    default: null
  },

  // Legacy file upload field (kept for compatibility)
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files' // Reference to GridFS file
  }
}, { timestamps: true });

// Hash password before saving (only for email auth users)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || this.authMethod === 'google') {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method (only for email auth users)
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (this.authMethod === 'google') {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP
userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  this.otp = otp;
  this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
  return otp;
};

// Generate password reset OTP
userSchema.methods.generatePasswordResetOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.passwordResetOtp = otp;
  this.passwordResetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return otp;
};

// Verify OTP
userSchema.methods.verifyOTP = function (candidateOtp) {
  if (!this.otp || !this.otpExpiry) return false;
  if (new Date() > this.otpExpiry) return false;
  return this.otp === candidateOtp;
};

// Verify password reset OTP
userSchema.methods.verifyPasswordResetOTP = function (candidateOtp) {
  if (!this.passwordResetOtp || !this.passwordResetOtpExpiry) return false;
  if (new Date() > this.passwordResetOtpExpiry) return false;
  return this.passwordResetOtp === candidateOtp;
};

module.exports = mongoose.model('User', userSchema);