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

        // Update user with the file ID
        // Assuming req.user.id is populated by auth middleware
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { fileId: req.file.id },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            fileId: req.file.id,
            filename: req.file.filename
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
