const { body, param, validationResult } = require('express-validator');

// Validation rules
exports.validateReservation = [
  body('donationId')
    .notEmpty()
    .withMessage('Donation ID is required')
    .isMongoId()
    .withMessage('Invalid donation ID'),
  
  body('scheduledPickup')
    .notEmpty()
    .withMessage('Scheduled pickup time is required')
    .isISO8601()
    .withMessage('Invalid date format'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

exports.validateReservationStatus = [
  body('status')
    .isIn(['confirmed', 'scheduled', 'picked_up', 'cancelled', 'no_show'])
    .withMessage('Invalid status'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];