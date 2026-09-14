import type { RequestHandler } from 'express';
import multer from 'multer';

import { env } from '../config/env.js';
import { AppError, ValidationError } from '../lib/errors.js';
import { ALLOWED_UPLOAD_TYPES } from '../lib/storage.js';

/**
 * Single-file multipart upload, held in memory until the service has checked the
 * caller may attach to the record — nothing touches disk for a request that is
 * about to be refused. The web client shrinks photos before sending, so the limit
 * is a backstop rather than the everyday size.
 */
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

export const singleFile =
  (field = 'file'): RequestHandler =>
  (req, res, next) => {
    uploader.single(field)(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(
            new AppError(
              `Files must be ${env.MAX_UPLOAD_MB} MB or smaller`,
              413,
              'PAYLOAD_TOO_LARGE',
            ),
          );
          return;
        }
        next(new ValidationError([{ field, message: error.message }]));
        return;
      }
      if (error) {
        next(error);
        return;
      }
      if (!req.file) {
        next(new ValidationError([{ field, message: 'Choose a file to upload' }]));
        return;
      }
      if (!ALLOWED_UPLOAD_TYPES[req.file.mimetype]) {
        next(new ValidationError([{ field, message: 'Upload a photo (JPG, PNG, WebP) or a PDF' }]));
        return;
      }
      next();
    });
  };
