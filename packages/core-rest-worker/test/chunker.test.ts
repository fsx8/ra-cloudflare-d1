import { describe, expect, it } from "vitest";
import {
  MAX_BOUND_PARAMS,
  chunkArray,
  chunkBulkDelete,
  chunkBulkUpdate,
} from "../src/sql/chunker";

describe("sql/chunker", () => {
  it("chunkArray splits into fixed-size chunks", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("chunkBulkDelete uses MAX_BOUND_PARAMS", () => {
    const ids = Array.from({ length: MAX_BOUND_PARAMS + 1 }, (_, i) => i + 1);
    const chunks = chunkBulkDelete(ids);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(MAX_BOUND_PARAMS);
    expect(chunks[1]).toHaveLength(1);
  });

  it("chunkBulkUpdate accounts for field count", () => {
    const ids = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(chunkBulkUpdate(ids, 1)[0]).toHaveLength(10);

    const limited = chunkBulkUpdate(ids, MAX_BOUND_PARAMS - 1);
    expect(limited).toEqual(ids.map((id) => [id]));
  });
});
