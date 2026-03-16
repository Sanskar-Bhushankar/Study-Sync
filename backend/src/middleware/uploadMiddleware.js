const multer = require('multer');
const { BadRequestError, AppError } = require('../utils/errors');

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(new AppError('Unsupported file type. Use PDF, JPEG or PNG.', 415, 'UNSUPPORTED_MEDIA'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter,
});

const singleNote = upload.single('file');

function uploadMiddleware(req, res, next) {
  singleNote(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError('File too large (max 10 MB)', 413, 'PAYLOAD_TOO_LARGE'));
      return next(err);
    }
    if (!req.file) return next(new BadRequestError('No file uploaded'));
    next();
  });
}

module.exports = uploadMiddleware;
