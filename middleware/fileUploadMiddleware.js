const multer = require("multer");

const allowedMimeTypes = [
  "application/pdf",
];

const storage = multer.memoryStorage();

const fileUploadMiddleware = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only PDF care-plan files are allowed")
      );
    }

    callback(null, true);
  },
});

module.exports = fileUploadMiddleware;