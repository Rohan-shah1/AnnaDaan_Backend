const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (idToken) => {
  try {
    console.log('Verifying Google ID token...');
    
    if (!idToken) {
      throw new Error('No ID token provided');
    }

    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    
    console.log('Google token verified for:', payload.email);
    
    return {
      success: true,
      user: {
        googleId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified,
        name: payload.name,
        firstName: payload.given_name,
        lastName: payload.family_name,
        picture: payload.picture,
        locale: payload.locale
      }
    };
  } catch (error) {
    console.error('Google token verification failed:', error.message);
    return {
      success: false,
      message: 'Invalid Google token',
      error: error.message
    };
  }
};

module.exports = { verifyGoogleToken };