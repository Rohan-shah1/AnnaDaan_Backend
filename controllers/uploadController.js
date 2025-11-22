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

// @desc    Get a file by ID
// @route   GET /api/upload/:id
// @access  Public
exports.getFile = async (req, res) => {
    try {
        const { getGridFSBucket } = require('../config/gridfs');
        const mongoose = require('mongoose');
        const gridfsBucket = getGridFSBucket();

        if (!gridfsBucket) {
            return res.status(500).json({
                success: false,
                message: 'GridFS not initialized'
            });
        }

        const _id = new mongoose.Types.ObjectId(req.params.id);
        const files = await gridfsBucket.find({ _id }).toArray();

        if (!files || files.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        const file = files[0];
        res.set('Content-Type', file.contentType);
        res.set('Content-Disposition', `inline; filename="${file.filename}"`);

        const downloadStream = gridfsBucket.openDownloadStream(_id);
        downloadStream.pipe(res);

    } catch (error) {
        console.error('File retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving file',
            error: error.message
        });
    }
};
