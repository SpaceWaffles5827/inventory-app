// HTTP helpers: a typed error that the global error handler understands, and
// small response builders that keep every body in the
// `{ status: "success" | "error", message, data }` shape.
import { Response } from "express";

export class HttpError extends Error {
  status: number;
  errors?: unknown;
  data?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    extra: { errors?: unknown; data?: Record<string, unknown> } = {}
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.errors = extra.errors;
    this.data = extra.data;
  }
}

export const badRequest = (message: string, errors?: unknown) =>
  new HttpError(400, message, { errors });
export const unauthorized = (message = "Unauthorized") =>
  new HttpError(401, message);
export const forbidden = (message = "Forbidden") => new HttpError(403, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
export const conflict = (message: string, data?: Record<string, unknown>) =>
  new HttpError(409, message, { data });

/** Error body. `error` duplicates `message` for older clients that read it. */
export function errorBody(message: string, extra: Record<string, unknown> = {}) {
  return { status: "error" as const, message, error: message, ...extra };
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  extra: Record<string, unknown> = {}
) {
  return res.status(status).json(errorBody(message, extra));
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  status = 200
) {
  return res
    .status(status)
    .json({ status: "success" as const, ...(message ? { message } : {}), data });
}
