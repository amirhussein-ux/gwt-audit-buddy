const multer = require('multer');

/**
 * Multer configuration for file uploads
 * Stores files in memory for immediate processing
 * Suitable for small files (< 5MB as configured in reportRoute)
 */

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allowed MIME types
  const allowedMimes = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

/**
 * Multer instance for report file uploads
 * - Max file size: 5MB
 * - Storage: Memory
 * - Field name: 'file'
 */
const reportUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

module.exports = {
  reportUpload,
};
