const express = require('express');
const router = express.Router();
const { upload } = require('../config/gridfs');
const { uploadFile } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth'); // Assuming auth middleware exists

// @route   POST /api/upload
// @desc    Upload a file
// @access  Private
router.post('/', protect, upload.single('file'), uploadFile);

module.exports = router;
