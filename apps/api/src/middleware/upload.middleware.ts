import multer from "multer";
import { ApiError } from "../utils/api-response.js";

const acceptedMimeTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);

export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 0,
  },
  fileFilter(_request, file, callback) {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      callback(new ApiError(400, "UNSUPPORTED_ATTACHMENT_TYPE", "Only PNG, JPEG, and PDF attachments are accepted."));
      return;
    }
    callback(null, true);
  },
});
