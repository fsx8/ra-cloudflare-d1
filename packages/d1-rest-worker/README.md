# d1-rest-worker

Cloudflare Worker library that exposes a React-Admin Simple REST compatible API backed by [D1](https://developers.cloudflare.com/d1/). Powered by the shared [`core-rest-worker`](https://www.npmjs.com/package/core-rest-worker) engine; the Turso counterpart is [`turso-rest-worker`](https://www.npmjs.com/package/turso-rest-worker).

```ts
import { createD1RestApi } from "d1-rest-worker";

export default {
  fetch(request, env, ctx) {
    return createD1RestApi({
      apiKey: env.API_KEY,
      corsOrigins: ["https://admin.example.com"], // whitelist your admin UI
      // rateLimit: { binding: env.API_RATE_LIMITER }, // optional, needs wrangler binding
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

The default D1 binding is `"DB"`; override it with the second argument:
`createD1RestApi(config, { dbBinding: "MY_DB" })`.

## Notes

- **Bulk operations** (`updateMany` / `deleteMany`) run in a single D1 `batch`,
  which is **not transactional** — partial success is possible. The worker falls
  back to per-statement requests if the batch fails. (The Turso/libSQL backend,
  by contrast, runs batches transactionally.)

## License

MIT
