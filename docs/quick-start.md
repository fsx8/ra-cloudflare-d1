# Quick Start (5 minutes)

## Step 1: Deploy the Worker API

Recommended (scaffold a ready-to-deploy Worker):

```bash
npx create-d1-rest-worker
cd d1-rest-worker
pnpm install
pnpm exec wrangler secret put API_KEY
pnpm run deploy
```

## Step 2: Install the data provider

```bash
pnpm add ra-cloudflare-d1
```

## Step 3: Configure React-Admin

```ts
import { createD1DataProvider } from "ra-cloudflare-d1";

export const dataProvider = createD1DataProvider({
  apiUrl: "https://YOUR_WORKER_URL/api",
  apiKey: "sk_...",
});
```

> **Security note:** The `apiKey` is sent from the browser in the
> `Authorization: Bearer` header. Any value embedded in client-side code is
> retrievable by visitors, so treat it as a **public** credential, not a
> secret. To limit exposure, configure `corsOrigins` on the Worker with your
> admin panel's exact origin(s) instead of `"*"` — browsers block cross-origin
> requests because every API call is preflighted (the `Authorization` header
> triggers it). This stops other websites from abusing the key but does **not**
> prevent server-side use (curl, scripts). For a production admin, put the
> Worker behind Cloudflare Access or JWT validation.
