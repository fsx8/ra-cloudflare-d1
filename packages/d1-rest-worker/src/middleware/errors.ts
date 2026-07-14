import type { Context } from "hono";
import type { ApiErrorCode, ApiErrorResponse } from "@ra-cloudflare-d1/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const DEFAULT_STATUS_BY_CODE: Record<ApiErrorCode, ContentfulStatusCode> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONSTRAINT_VIOLATION: 409,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: ContentfulStatusCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
    status?: ContentfulStatusCode,
  ) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = status ?? DEFAULT_STATUS_BY_CODE[code];
  }
}

export function handleError(err: unknown, c: Context): Response {
  if (err instanceof ApiError) {
    const payload: ApiErrorResponse = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    return c.json(payload, err.status);
  }

  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes("UNIQUE constraint failed") ||
    message.includes("FOREIGN KEY constraint failed") ||
    message.includes("CHECK constraint failed") ||
    message.includes("NOT NULL constraint failed") ||
    message.includes("PRIMARY KEY constraint failed")
  ) {
    const payload: ApiErrorResponse = {
      error: { code: "CONSTRAINT_VIOLATION", message },
    };
    return c.json(payload, DEFAULT_STATUS_BY_CODE.CONSTRAINT_VIOLATION);
  }

  const payload: ApiErrorResponse = {
    error: { code: "INTERNAL_ERROR", message: "Internal error" },
  };
  return c.json(payload, 500);
}
