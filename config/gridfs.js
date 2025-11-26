const multer = require('multer');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const crypto = require('crypto');
const path = require('path');

// Initialize GridFS bucket
let gridfsBucket;

// Initialize GridFS connection
mongoose.connection.once('open', () => {
  gridfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
  console.log('GridFS bucket initialized');
});

// Use memory storage for multer (we'll handle GridFS manually in controller)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images, PDFs, and DOCX
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs and documents are allowed!'), false);
    }
  }
});

// Helper function to upload to GridFS
const uploadToGridFS = (buffer, originalname, mimetype, userId) => {
  return new Promise((resolve, reject) => {
    const filename = crypto.randomBytes(16).toString('hex') + path.extname(originalname);

    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: mimetype,
      metadata: {
        originalName: originalname,
        uploadedBy: userId,
        uploadDate: new Date()
      }
    });

    uploadStream.on('error', (error) => {
      reject(error);
    });

    uploadStream.on('finish', () => {
      // Use uploadStream.id (not file._id - finish event doesn't pass file object)
      resolve({
        _id: uploadStream.id,
        filename: filename,
        contentType: mimetype,
        size: buffer.length,
        uploadDate: new Date()
      });
    });

    uploadStream.end(buffer);
  });
};

module.exports = { upload, uploadToGridFS, getGridFSBucket: () => gridfsBucket };
