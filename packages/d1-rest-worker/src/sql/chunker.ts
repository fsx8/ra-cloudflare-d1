import { ApiError } from "../middleware/errors.js";

export const MAX_BOUND_PARAMS = 100;

export function chunkArray<T>(array: T[], size: number): T[][] {
  if (size <= 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function chunkBulkDelete<T extends string | number>(ids: T[]): T[][] {
  return chunkArray(ids, MAX_BOUND_PARAMS);
}

export function chunkBulkUpdate<T extends string | number>(
  ids: T[],
  dataFieldCount: number,
): T[][] {
  const maxIdsPerChunk = MAX_BOUND_PARAMS - dataFieldCount;
  if (maxIdsPerChunk <= 0) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Too many fields to update (${dataFieldCount}). Maximum is ${MAX_BOUND_PARAMS - 1}.`,
    );
  }
  return chunkArray(ids, maxIdsPerChunk);
}
