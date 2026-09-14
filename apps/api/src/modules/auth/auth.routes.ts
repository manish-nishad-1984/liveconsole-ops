import { Router } from 'express';

import { asyncHandler } from '../../lib/http.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter, passwordResetLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.schema.js';

export const authRoutes = Router();

/* --- public ------------------------------------------------------------- */

authRoutes.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));

authRoutes.post('/refresh', validate({ body: refreshSchema }), asyncHandler(controller.refresh));

authRoutes.post(
  '/forgot-password',
  passwordResetLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(controller.forgotPassword),
);

authRoutes.post(
  '/reset-password',
  passwordResetLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(controller.resetPassword),
);

/** Logout tolerates an expired access token — signing out must always work. */
authRoutes.post('/logout', asyncHandler(controller.logout));

/* --- authenticated ------------------------------------------------------ */

authRoutes.get('/me', authenticate, asyncHandler(controller.me));

/**
 * Editing your own profile needs no permission — it is your own record, and the
 * schema limits it to the fields that carry no authority.
 */
authRoutes.patch(
  '/profile',
  authenticate,
  validate({ body: updateProfileSchema }),
  asyncHandler(controller.updateProfile),
);

authRoutes.get('/sessions', authenticate, asyncHandler(controller.sessions));

authRoutes.post('/logout-all', authenticate, asyncHandler(controller.logoutAll));

authRoutes.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler(controller.changePassword),
);
