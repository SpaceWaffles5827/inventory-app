// Request validation built on zod.
//
// parse()/parseBody()/parseQuery() throw an HttpError(400) whose message is the
// first issue in plain English (e.g. "Quantity must be a positive whole number")
// and whose `errors` array lists every issue as { path, message }. The global
// error handler turns that into:
//   400 { status: "error", message, error: message, errors: [...] }
import { Request } from "express";
import { z, ZodError, ZodTypeAny } from "zod";
import { HttpError } from "./http";

// ---------------------------------------------------------------------------
// Human readable messages
// ---------------------------------------------------------------------------

/** "fromLocationId" -> "From location ID" */
export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w.toLowerCase() === "id" ? "ID" : w.toLowerCase()));
  if (words.length === 0) return "Value";
  words[0] = words[0] === "ID" ? "ID" : words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

function labelFor(path: (string | number)[]): string {
  const keys = path.filter((p): p is string => typeof p === "string");
  const indexes = path.filter((p): p is number => typeof p === "number");
  const base = keys.length ? humanize(keys[keys.length - 1]) : "Value";
  return indexes.length ? `${base} (#${indexes[indexes.length - 1] + 1})` : base;
}

const errorMap: z.ZodErrorMap = (issue, ctx) => {
  const label = labelFor(issue.path);
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: issue.path.length ? `${label} is required` : "Request body is required" };
      }
      if (issue.expected === "object" && issue.path.length === 0) {
        return { message: "Request body must be a JSON object" };
      }
      return { message: `${label} must be a ${issue.expected}` };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return {
          message:
            Number(issue.minimum) <= 1
              ? `${label} is required`
              : `${label} must be at least ${issue.minimum} characters`,
        };
      }
      if (issue.type === "array") {
        return { message: `${label} must contain at least ${issue.minimum} entr${Number(issue.minimum) === 1 ? "y" : "ies"}` };
      }
      return { message: `${label} must be at least ${issue.minimum}` };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") {
        return { message: `${label} must be at most ${issue.maximum} characters` };
      }
      if (issue.type === "array") {
        return { message: `${label} can contain at most ${issue.maximum} entries` };
      }
      return { message: `${label} must be at most ${issue.maximum}` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `${label} must be one of: ${issue.options.join(", ")}` };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: `${label} must be a valid email address` };
      return { message: `${label} is invalid` };
    case z.ZodIssueCode.invalid_date:
      return { message: `${label} must be a valid date` };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: `Unknown field(s): ${issue.keys.join(", ")}` };
    default:
      return { message: issue.path.length ? `${label}: ${ctx.defaultError}` : ctx.defaultError };
  }
};

z.setErrorMap(errorMap);

export function formatZodError(err: ZodError) {
  const errors = err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  return { message: errors[0]?.message ?? "Invalid request", errors };
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

export function parse<S extends ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const { message, errors } = formatZodError(result.error);
    throw new HttpError(400, message, { errors });
  }
  return result.data;
}

export const parseBody = <S extends ZodTypeAny>(schema: S, req: Request): z.output<S> =>
  parse(schema, req.body ?? {});

export const parseQuery = <S extends ZodTypeAny>(schema: S, req: Request): z.output<S> =>
  parse(schema, req.query ?? {});

export const parseParams = <S extends ZodTypeAny>(schema: S, req: Request): z.output<S> =>
  parse(schema, req.params ?? {});

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

/** Numeric strings ("5") become numbers; everything else passes through untouched. */
const toNumber = (v: unknown) =>
  typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : v;

/** "" is treated as "not provided" (null) — HTML forms send empty strings. */
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const MAX_QTY = 1_000_000_000;

export const zId = z.string().trim().min(1).max(191);

/** Optional reference id: undefined = not provided, ""/null = clear it. */
export const zOptionalId = z.preprocess(emptyToNull, zId.nullable().optional());

export const zIdArray = z.array(zId).max(500);

export const zPositiveInt = (label: string) =>
  z.preprocess(
    toNumber,
    z
      .number({
        required_error: `${label} is required`,
        invalid_type_error: `${label} must be a number`,
      })
      .int(`${label} must be a positive whole number`)
      .positive(`${label} must be a positive whole number`)
      .max(MAX_QTY, `${label} is too large`)
  );

export const zNonNegativeInt = (label: string) =>
  z.preprocess(
    toNumber,
    z
      .number({
        required_error: `${label} is required`,
        invalid_type_error: `${label} must be a number`,
      })
      .int(`${label} must be a whole number of 0 or more`)
      .min(0, `${label} must be a whole number of 0 or more`)
      .max(MAX_QTY, `${label} is too large`)
  );

export const zMoney = (label: string) =>
  z.preprocess(
    toNumber,
    z
      .number({
        required_error: `${label} is required`,
        invalid_type_error: `${label} must be a number`,
      })
      .finite(`${label} must be a number`)
      .min(0, `${label} cannot be negative`)
      .max(1_000_000_000_000, `${label} is too large`)
  );

/** Required, trimmed, non-empty string. */
export const zText = (max = 191) => z.string().trim().min(1).max(max);

/** Optional string: undefined = not provided, ""/null = clear it (stored as null). */
export const zOptionalText = (max = 191) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

/** Optional date: accepts ISO strings / timestamps; ""/null clears it. */
export const zOptionalDate = z.preprocess(
  (v) => {
    const n = emptyToNull(v);
    if (n === null || n === undefined) return n;
    if (typeof n === "string" || typeof n === "number") return new Date(n);
    return n;
  },
  z.date().nullable().optional()
);

export const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(191)
  .email();

export const zRole = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.enum(["OWNER", "ADMIN", "MEMBER"])
);

export const zBooleanish = z.preprocess(
  (v) => (v === "true" ? true : v === "false" ? false : v),
  z.boolean()
);

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * Cursor pagination: `?limit=&cursor=`. Without a limit the endpoint returns
 * everything up to `defaultLimit` (kept high so existing clients still get the
 * full list).
 */
export const paginationQuery = (defaultLimit: number, maxLimit: number) =>
  z.object({
    limit: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : toNumber(v)),
      z.number().int().min(1).max(maxLimit).default(defaultLimit)
    ),
    cursor: z.preprocess(emptyToNull, zId.nullable().optional()),
  });
