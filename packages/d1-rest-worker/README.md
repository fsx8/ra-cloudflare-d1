# d1-rest-worker

Cloudflare Worker library that exposes a React-Admin Simple REST compatible API backed by D1.

```ts
import { createD1RestApi } from "d1-rest-worker";

export default {
  fetch(request, env, ctx) {
    return createD1RestApi({
      apiKey: env.API_KEY,
      corsOrigins: ["https://admin.example.com"], // whitelist your admin UI
      resources: {
        posts: {
          tableName: "posts",
          idField: "id",
          selectableFields: ["id", "title"],
          filterableFields: ["id", "title"],
          sortableFields: ["id", "title"],
          searchableFields: ["title"],
        },
      },
    }).fetch(request, env, ctx);
  },
};
```
