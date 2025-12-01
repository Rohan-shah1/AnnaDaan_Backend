const mongoose = require('mongoose');

const gridFSFileSchema = new mongoose.Schema({
    length: Number,
    chunkSize: Number,
    uploadDate: Date,
    filename: String,
    md5: String,
    contentType: String,
    metadata: mongoose.Schema.Types.Mixed
}, { strict: false });

module.exports = mongoose.model('uploads.files', gridFSFileSchema, 'uploads.files');
