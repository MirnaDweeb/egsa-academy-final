const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { AppError } = require('./error');

// Private storage directory strictly isolated from public web static roots
const privateDocsDir = path.resolve(__dirname, '../../../../data/uploads/private_documents');
if (!fs.existsSync(privateDocsDir)) {
  fs.mkdirSync(privateDocsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, privateDocsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext) ? ext : '.png';
    const uniqueId = crypto.randomUUID();
    cb(null, `appdoc_${uniqueId}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeValid = allowedMimeTypes.includes(file.mimetype);
  const isExtValid = allowedExtensions.includes(ext);

  if (!isMimeValid || !isExtValid) {
    return cb(
      new AppError(
        'Invalid file format. Uploaded screenshot or document must be an authentic JPEG, PNG, WEBP, or PDF.',
        400
      ),
      false
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
});

/**
 * Validates genuine file signatures (magic bytes) to prevent extension spoofing.
 */
function validateDocumentMagicBytes(filePath) {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    // WEBP: 'RIFF' at 0..3 and 'WEBP' at 8..11
    const isWebp =
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
    // PDF: '%PDF' at 0..3
    const isPdf = buffer.toString('ascii', 0, 4) === '%PDF';

    return isJpeg || isPng || isWebp || isPdf;
  } catch (_) {
    return false;
  }
}

module.exports = {
  applicationDocumentUpload: upload,
  validateDocumentMagicBytes,
  privateDocsDir,
};
