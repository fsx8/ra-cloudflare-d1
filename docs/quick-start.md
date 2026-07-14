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
> retrievable by visitors, so treat it as a **public** credential — it deters
> casual traffic and cross-origin abuse but is **not** a true secret. For a
> production admin, put the Worker behind a proper authentication layer
> (Cloudflare Access, JWT validation, etc.) instead of relying solely on the
> shared bearer key.
