import { createD1RestApi } from "d1-rest-worker";

function parseCors(origins: unknown): string[] | "*" {
  if (!origins) return "*";
  if (origins === "*") return "*";
  if (typeof origins !== "string") return "*";
  const parts = origins
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : "*";
}

export default {
  fetch(request: Request, env: any, ctx: ExecutionContext) {
    return createD1RestApi({
      apiKey: env.API_KEY,
      corsOrigins: parseCors(env.CORS_ORIGINS),
      resources: {
        posts: {
          tableName: "posts",
          idField: "id",
          selectableFields: ["id", "title", "body", "created_at"],
          filterableFields: ["id", "title", "created_at"],
          sortableFields: ["id", "title", "created_at"],
          searchableFields: ["title", "body"],
          softDelete: { field: "deleted_at", type: "timestamp" },
          transforms: { dates: ["created_at"], booleans: [] },
        },
      },
    }).fetch(request, env, ctx);
  },
};
