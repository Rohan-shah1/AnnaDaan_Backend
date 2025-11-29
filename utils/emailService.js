const nodemailer = require('nodemailer');

// Create transporter (configure with your SMTP settings)
const transporter = nodemailer.createTransport({
    service: 'gmail', // or 'smtp.gmail.com'
    auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASSWORD // App-specific password
    }
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

/**
 * Send verification OTP email
 */
const sendVerificationOTP = async (email, name, otp) => {
    const mailOptions = {
        from: `"AnnaDaan" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify Your Email - AnnaDaan',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to AnnaDaan!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for signing up. Please use the following OTP to verify your email address:</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #2563eb; letter-spacing: 5px; margin: 0;">${otp}</h1>
        </div>
        <p><strong>This OTP will expire in 10 minutes.</strong></p>
        <p>If you didn't create an account with AnnaDaan, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">AnnaDaan - Connecting Food Donors with Those in Need</p>
      </div>
    `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw new Error('Failed to send verification email');
    }
};

/**
 * Send password reset OTP email
 */
const sendPasswordResetOTP = async (email, name, otp) => {
    const mailOptions = {
        from: `"AnnaDaan" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset OTP - AnnaDaan',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Use the following OTP to proceed:</p>
        <div style="background-color: #fef2f2; padding: 20px; text-align: center; margin: 20px 0; border: 2px solid #fecaca;">
          <h1 style="color: #dc2626; letter-spacing: 5px; margin: 0;">${otp}</h1>
        </div>
        <p><strong>This OTP will expire in 10 minutes.</strong></p>
        <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">AnnaDaan - Connecting Food Donors with Those in Need</p>
      </div>
    `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('Failed to send password reset email');
    }
};

module.exports = {
    sendVerificationOTP,
    sendPasswordResetOTP
};
