// Global 404 + error handlers. Every error leaves as
//   { status: "error", message, error: message, errors?, data? }
// 5xx bodies never include internals; the real error goes to the logger.
import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { HttpError, errorBody } from "../utils/http";
import { formatZodError } from "../utils/validate";
import logger from "../utils/logger";
import { redactUrl } from "../utils/redact";

export function apiNotFound(req: Request, res: Response) {
  res.status(404).json(errorBody(`Not found: ${req.method} ${redactUrl(req.originalUrl.split("?")[0])}`));
}

function toResponse(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof HttpError) {
    const extra: Record<string, unknown> = {};
    if (err.errors !== undefined) extra.errors = err.errors;
    if (err.data !== undefined) extra.data = err.data;
    return { status: err.status, body: errorBody(err.message, extra) };
  }

  if (err instanceof ZodError) {
    const { message, errors } = formatZodError(err);
    return { status: 400, body: errorBody(message, { errors }) };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = (err.meta as { target?: unknown } | undefined)?.target;
        return {
          status: 409,
          body: errorBody("A record with this value already exists", { target: target ?? null }),
        };
      }
      case "P2025":
        return { status: 404, body: errorBody("Record not found") };
      case "P2003":
        return { status: 400, body: errorBody("A referenced record does not exist") };
      case "P2034":
        return {
          status: 409,
          body: errorBody("This change conflicted with another update. Please try again."),
        };
    }
  }

  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return { status: 413, body: errorBody("File too large (max 10 MB)") };
    }
    return { status: 400, body: errorBody(`Upload rejected: ${err.message}`) };
  }

  // body-parser / other http-errors style errors
  const e = err as { type?: string; status?: number; statusCode?: number; expose?: boolean; message?: string };
  if (e?.type === "entity.parse.failed") {
    return { status: 400, body: errorBody("Malformed JSON body") };
  }
  if (e?.type === "entity.too.large") {
    return { status: 413, body: errorBody("Request body too large") };
  }
  const status = e?.status ?? e?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return { status, body: errorBody(e.expose !== false && e.message ? e.message : "Bad request") };
  }

  return { status: 500, body: errorBody("Internal server error") };
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  const { status, body } = toResponse(err);
  if (status >= 500) {
    logger.error("request failed", {
      method: req.method,
      url: redactUrl(req.originalUrl),
      userId: req.user?.id,
      error: err instanceof Error ? err.stack || err.message : String(err),
    });
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn("prisma request error", { code: err.code, url: redactUrl(req.originalUrl) });
  }
  if (res.headersSent) return next(err);
  res.status(status).json(body);
}
