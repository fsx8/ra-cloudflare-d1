# ra-cloudflare-d1

React-Admin data provider for [Cloudflare D1](https://developers.cloudflare.com/d1/) backends served by the [`d1-rest-worker`](https://www.npmjs.com/package/d1-rest-worker) package. This is the **source of truth** provider implementation; the Turso counterpart [`ra-turso`](https://www.npmjs.com/package/ra-turso) is a Turso-branded re-export of this package, since both workers speak the same Simple-REST dialect.

## Install

```bash
pnpm add ra-cloudflare-d1
```

## Usage

```ts
import { Admin, Resource, ListGuesser } from "react-admin";
import { createD1DataProvider } from "ra-cloudflare-d1";

const dataProvider = createD1DataProvider({
  apiUrl: "https://YOUR_WORKER_URL/api",
  apiKey: "sk_...",
});

export const App = () => (
  <Admin dataProvider={dataProvider}>
    <Resource name="posts" list={ListGuesser} />
  </Admin>
);
```

Supports `getList`, `getOne`, `getMany`, `getManyReference`, `create`, `update`, `updateMany`, `delete`, `deleteMany`, abort signals, and optional client-side field transforms.

> **Security:** `apiKey` is sent from the browser and is retrievable by visitors — treat it as public. Restrict `corsOrigins` on the Worker to your admin origin, and for production put the Worker behind Cloudflare Access or JWT validation.

## License

MIT
