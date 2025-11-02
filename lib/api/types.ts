// lib/api/types.ts

/**
 * Base API response structure
 * Contains status and optional message
 */
export type ApiResponseBase = {
  status: "success" | "error";
  message?: string;
};

/**
 * API response with required data payload
 * Use this when the endpoint always returns data on success
 *
 * @example
 * type UsersResponse = ApiResponse<{ users: User[] }>
 */
export type ApiResponse<T> = ApiResponseBase & {
  data: T;
};

/**
 * API response with optional data payload
 * Use this for endpoints that may or may not return data (e.g., delete operations)
 *
 * @example
 * type DeleteResponse = ApiResponseMaybe<{ deletedCount: number }>
 */
export type ApiResponseMaybe<T> = ApiResponseBase & {
  data?: T;
};
