// Client-side API helper functions for authentication

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
  const response = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to create account");
  }

  return result;
}

/**
 * Login an existing user
 */
export async function loginUserApi(
  data: LoginRequest
): Promise<AuthApiResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to login");
  }

  return result;
}

/**
 * Get current user profile
 */
export async function getUserProfileApi(): Promise<UserProfileResponse> {
  const response = await fetch("/api/auth/profile", {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch user profile");
  }

  return result;
}

/**
 * Update current user profile
 */
export async function updateUserProfileApi(
  data: UpdateProfileRequest
): Promise<AuthApiResponse> {
  const response = await fetch("/api/auth/profile", {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update profile");
  }

  return result;
}

/**
 * Logout current user
 */
export async function logoutUserApi(): Promise<AuthApiResponse> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to logout");
  }

  return result;
}

/**
 * Request password reset
 */
export async function forgotPasswordApi(
  email: string
): Promise<AuthApiResponse> {
  const response = await fetch("/api/auth/password-change-request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to send reset email");
  }

  return result;
}

/**
 * Reset password with token
 */
export async function resetPasswordApi(
  token: string,
  newPassword: string,
  confirmPassword: string
): Promise<AuthApiResponse> {
  const response = await fetch(`/api/auth/password-reset/${token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ newPassword, confirmPassword }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to reset password");
  }

  return result;
}

/**
 * Change password (when logged in)
 */
export async function changePasswordApi(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<AuthApiResponse> {
  const response = await fetch("/api/auth/password", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to change password");
  }

  return result;
}
