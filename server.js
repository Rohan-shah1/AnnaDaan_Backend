const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import the external database connection
const connectDB = require('./config/database');
require('./models/GridFSFile'); // Register GridFS model for population

const app = express();

// Security Middleware
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000
});
app.use(limiter);

// CORS Configuration
app.use(cors({
  origin: process.env.CLIENT_URL || ['http://localhost:3000', 'http://10.0.2.2:3000'],
  credentials: true
}));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic Routes
app.get('/', (req, res) => {
  res.json({
    message: 'AnnaDaan Backend API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  // Get mongoose instance from the database connection
  const mongoose = require('mongoose');
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// Import Routes
const authRoutes = require('./routes/auth');
const donationRoutes = require('./routes/donations');
const reservationRoutes = require('./routes/reservations');
const notificationRoutes = require('./routes/notifications');
const uploadRoutes = require('./routes/upload');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start Server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Use the external database connection
    await connectDB();

    app.listen(PORT, () => {
      const mongoose = require('mongoose');
      console.log(`
AnnaDaan Server Started!
Port: ${PORT}
Environment: ${process.env.NODE_ENV || 'development'}
Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}
Started at: ${new Date().toISOString()}
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', err);
  process.exit(1);
});

startServer();

module.exports = app;