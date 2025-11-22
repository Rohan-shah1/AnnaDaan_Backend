const { uploadToGridFS } = require('../config/gridfs');

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

        // Upload buffer to GridFS
        const fileInfo = await uploadToGridFS(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            req.user ? req.user._id : null
        );

        // Return file info in the format frontend expects
        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            file: fileInfo
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
