const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const crypto = require('crypto');
const path = require('path');

// Create storage engine
const storage = new GridFsStorage({
  url: process.env.MONGODB_URI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads', // Collection name: uploads.files, uploads.chunks
          metadata: {
            originalName: file.originalname,
            uploadedBy: req.user ? req.user._id : null,
            uploadDate: new Date()
          },
          contentType: file.mimetype
        };
        resolve(fileInfo);
      });
    });
  }
});

// Add error handling
storage.on('connection', (db) => {
  console.log('GridFS storage connected');
});

storage.on('connectionFailed', (err) => {
  console.error('GridFS connection failed:', err);
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

module.exports = upload;
