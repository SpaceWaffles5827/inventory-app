// Client-side API helper functions for authentication
import { apiRequest } from "./client";

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserProfileResponse {
  status: "success" | "error";
  message: string;
  data?: {
    user?: {
      id: string;
      email: string;
      name: string;
    };
  };
}

export interface UpdateProfileRequest {
  name: string;
}

export interface AuthApiResponse {
  status: "success" | "error";
  message: string;
  data?: {
    user?: {
      id: string;
      email: string;
      name: string;
    };
    token?: string;
    loggedIn?: boolean;
  };
}

/**
 * Register a new user
 */
export async function registerUserApi(
  data: RegisterRequest
): Promise<AuthApiResponse> {
  return apiRequest<AuthApiResponse>("/api/auth/register", {
    method: "POST",
    body: data,
    errorMessage: "Failed to create account",
    redirectOnUnauthorized: false,
  });
}

/**
 * Login an existing user
 */
export async function loginUserApi(
  data: LoginRequest
): Promise<AuthApiResponse> {
  return apiRequest<AuthApiResponse>("/api/auth/login", {
    method: "POST",
    body: data,
    errorMessage: "Failed to login",
    redirectOnUnauthorized: false,
  });
}

/**
 * Get current user profile
 */
export async function getUserProfileApi(): Promise<UserProfileResponse> {
  return apiRequest<UserProfileResponse>("/api/auth/profile", {
    errorMessage: "Failed to fetch user profile",
    redirectOnUnauthorized: false,
  });
}

/**
 * Update current user profile
 */
export async function updateUserProfileApi(
  data: UpdateProfileRequest
): Promise<AuthApiResponse> {
  return apiRequest<AuthApiResponse>("/api/auth/profile", {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update profile",
  });
}

/**
 * Logout current user
 */
export async function logoutUserApi(): Promise<AuthApiResponse> {
  return apiRequest<AuthApiResponse>("/api/auth/logout", {
    method: "POST",
    errorMessage: "Failed to logout",
  });
}

/**
 * Request password reset
 */
export async function forgotPasswordApi(
  email: string
): Promise<AuthApiResponse> {
  return apiRequest<AuthApiResponse>("/api/auth/password-change-request", {
    method: "POST",
    body: { email },
    errorMessage: "Failed to send reset email",
    redirectOnUnauthorized: false,
  });
}

/**
 * Reset password with token
 */
export async function resetPasswordApi(
  token: string,
  newPassword: string,
  confirmPassword: string
): Promise<AuthApiResponse> {
  return apiRequest<AuthApiResponse>(`/api/auth/password-reset/${token}`, {
    method: "POST",
    body: { newPassword, confirmPassword },
    errorMessage: "Failed to reset password",
    redirectOnUnauthorized: false,
  });
}

/**
 * Change password (when logged in)
 */
export async function changePasswordApi(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<AuthApiResponse> {
  return apiRequest<AuthApiResponse>("/api/auth/password", {
    method: "PUT",
    body: { currentPassword, newPassword, confirmNewPassword },
    errorMessage: "Failed to change password",
    redirectOnUnauthorized: false,
  });
}
