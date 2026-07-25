import type { RestWorkerConfig, ResourceConfig } from "rest-worker-types";
import { ApiError } from "../middleware/errors.js";

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function validateIdentifier(
  identifier: string,
  context: string,
): string {
  if (!IDENTIFIER_RE.test(identifier)) {
    throw new ApiError("VALIDATION_ERROR", `Invalid ${context} identifier`, {
      identifier,
    });
  }
  return identifier;
}

export function validateResource(
  resource: string | undefined,
  config: RestWorkerConfig,
): ResourceConfig {
  if (!resource) {
    throw new ApiError("VALIDATION_ERROR", "Resource is required");
  }
  const resourceConfig = config.resources[resource];
  if (!resourceConfig) {
    throw new ApiError("FORBIDDEN", `Resource '${resource}' is not allowed`, {
      resource,
    });
  }
  validateIdentifier(resourceConfig.tableName, "table");
  return resourceConfig;
}

export function validateField(
  field: string,
  allowlist: string[],
  context: string,
  alwaysAllowed?: string,
): string {
  if (alwaysAllowed && field === alwaysAllowed) {
    return validateIdentifier(field, "field");
  }
  if (!allowlist.includes(field)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Field '${field}' is not ${context}`,
      {
        field,
        allowedFields: allowlist,
      },
    );
  }
  validateIdentifier(field, "field");
  return field;
}
