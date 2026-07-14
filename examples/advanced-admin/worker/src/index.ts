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
          selectableFields: [
            "id",
            "title",
            "body",
            "status",
            "is_featured",
            "created_at",
            "user_id",
          ],
          filterableFields: [
            "id",
            "title",
            "status",
            "is_featured",
            "created_at",
            "user_id",
          ],
          sortableFields: ["id", "title", "created_at"],
          searchableFields: ["title", "body"],
          softDelete: { field: "deleted_at", type: "timestamp" },
          transforms: { dates: ["created_at"], booleans: ["is_featured"] },
        },
        users: {
          tableName: "users",
          idField: "id",
          selectableFields: ["id", "email", "is_admin", "created_at"],
          filterableFields: ["id", "email", "is_admin", "created_at"],
          sortableFields: ["id", "email", "created_at"],
          searchableFields: ["email"],
          transforms: { dates: ["created_at"], booleans: ["is_admin"] },
        },
      },
    }).fetch(request, env, ctx);
  },
};
