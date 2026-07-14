import type { ResourceConfig } from "@ra-cloudflare-d1/types";

function toBoolean(value: unknown): unknown {
  if (value === 1) return true;
  if (value === 0) return false;
  return value;
}

function toDate(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return value;
  return new Date(t).toISOString();
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function transformRecord(
  config: ResourceConfig,
  row: Record<string, unknown>,
) {
  const out: Record<string, unknown> = { ...row };
  const transforms = config.transforms;

  for (const field of transforms?.booleans ?? []) {
    if (field in out) out[field] = toBoolean(out[field]);
  }
  for (const field of transforms?.dates ?? []) {
    if (field in out) out[field] = toDate(out[field]);
  }
  for (const field of transforms?.json ?? []) {
    if (field in out) out[field] = parseJson(out[field]);
  }
  return out;
}
