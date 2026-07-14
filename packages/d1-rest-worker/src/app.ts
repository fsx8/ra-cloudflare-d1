import { Hono } from "hono";
import type { D1RestConfig } from "@ra-cloudflare-d1/types";
import { authMiddleware } from "./middleware/auth.js";
import { corsMiddleware } from "./middleware/cors.js";
import { handleError } from "./middleware/errors.js";
import { bulkDeleteRoute } from "./routes/bulkDelete.js";
import { bulkUpdateRoute } from "./routes/bulkUpdate.js";
import { createRoute } from "./routes/create.js";
import { deleteRoute } from "./routes/delete.js";
import { listRoute } from "./routes/list.js";
import { oneRoute } from "./routes/one.js";
import { schemaRoute } from "./routes/schema.js";
import { updateRoute } from "./routes/update.js";

export function createApp(config: D1RestConfig, dbBinding = "DB") {
  const app = new Hono();
  app.onError((err, c) => handleError(err, c));
  app.use("*", corsMiddleware(config));
  app.use("*", authMiddleware(config.apiKey));

  const basePath = config.basePath ?? "/api";
  const api = new Hono();

  api.get("/__schema", (c) => schemaRoute(c, config, dbBinding));
  api.get("/:resource", (c) => listRoute(c, config, dbBinding));
  api.get("/:resource/:id", (c) => oneRoute(c, config, dbBinding));
  api.post("/:resource", (c) => createRoute(c, config, dbBinding));
  api.put("/:resource/:id", (c) => updateRoute(c, config, dbBinding));
  api.delete("/:resource/:id", (c) => deleteRoute(c, config, dbBinding));
  api.post("/:resource/__bulkUpdate", (c) =>
    bulkUpdateRoute(c, config, dbBinding),
  );
  api.post("/:resource/__bulkDelete", (c) =>
    bulkDeleteRoute(c, config, dbBinding),
  );

  app.route(basePath, api);
  return app;
}
