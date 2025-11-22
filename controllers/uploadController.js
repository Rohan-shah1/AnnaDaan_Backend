const User = require('../models/User');

// @desc    Upload a file and link it to the user
// @route   POST /api/upload
// @access  Private
exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Return file info in the format frontend expects
        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            file: {
                _id: req.file.id,
                filename: req.file.filename,
                contentType: req.file.contentType,
                size: req.file.size,
                uploadDate: req.file.uploadDate
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during file upload',
            error: error.message
        });
    }
};
