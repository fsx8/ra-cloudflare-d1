type RecordLike = Record<string, unknown>;

function transformValue(value: unknown, kind: "boolean" | "date" | "json") {
  if (kind === "boolean") {
    if (value === 1) return true;
    if (value === 0) return false;
    return value;
  }
  if (kind === "date") {
    if (typeof value !== "string") return value;
    const t = Date.parse(value);
    if (Number.isNaN(t)) return value;
    return new Date(t).toISOString();
  }
  if (kind === "json") {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

export function applyTransforms(
  resource: string,
  data: unknown,
  transforms?: {
    booleanFields?: Record<string, string[]>;
    dateFields?: Record<string, string[]>;
    jsonFields?: Record<string, string[]>;
  },
): unknown {
  if (!transforms) return data;

  const bools = new Set(transforms.booleanFields?.[resource] ?? []);
  const dates = new Set(transforms.dateFields?.[resource] ?? []);
  const jsons = new Set(transforms.jsonFields?.[resource] ?? []);

  const transformRecord = (row: RecordLike) => {
    const out: RecordLike = { ...row };
    for (const key of Object.keys(out)) {
      if (bools.has(key)) out[key] = transformValue(out[key], "boolean");
      if (dates.has(key)) out[key] = transformValue(out[key], "date");
      if (jsons.has(key)) out[key] = transformValue(out[key], "json");
    }
    return out;
  };

  if (Array.isArray(data)) {
    return (data as unknown[]).map((r) =>
      r && typeof r === "object" ? transformRecord(r as RecordLike) : r,
    );
  }
  if (data && typeof data === "object")
    return transformRecord(data as RecordLike);
  return data;
}
