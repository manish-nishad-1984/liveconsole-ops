import type {
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  SessionDto,
  UpdateProfileRequest,
} from '@liveconsole-ops/types';

import { api } from '@/lib/api-client';

/**
 * API service layer: one module per resource, mirroring the API's route table.
 * Components and hooks never call `api.*` directly — they call these, so a route
 * change or a response reshape lands in one file.
 */
export const authService = {
  login: (payload: LoginRequest) => api.post<LoginResponse>('/auth/login', payload),

  /** The refresh cookie carries the session; the body only signals "remember me". */
  refresh: (rememberMe = false) => api.post<LoginResponse>('/auth/refresh', { rememberMe }),

  logout: () => api.post<void>('/auth/logout'),

  logoutAll: () => api.post<void>('/auth/logout-all'),

  me: () => api.get<AuthUser>('/auth/me'),

  updateProfile: (payload: UpdateProfileRequest) => api.patch<AuthUser>('/auth/profile', payload),

  sessions: () => api.get<SessionDto[]>('/auth/sessions'),

  changePassword: (payload: ChangePasswordRequest) =>
    api.post<{ message: string }>('/auth/change-password', payload),

  forgotPassword: (email: string) =>
    api.post<{ message: string; devToken?: string }>('/auth/forgot-password', { email }),

  resetPassword: (payload: ResetPasswordRequest) =>
    api.post<{ message: string }>('/auth/reset-password', payload),
};
