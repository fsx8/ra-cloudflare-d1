# ra-cloudflare-d1

React-Admin data provider for a Cloudflare D1 REST Worker (Simple REST dialect).

```ts
import { createD1DataProvider } from "ra-cloudflare-d1";

export const dataProvider = createD1DataProvider({
  apiUrl: "https://YOUR_WORKER_URL/api",
  apiKey: "sk_...",
});
```
