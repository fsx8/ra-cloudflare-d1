# ra-turso

React-Admin data provider for [Turso](https://turso.tech) backends served by the [`turso-rest-worker`](https://www.npmjs.com/package/turso-rest-worker) package. It is a Turso-branded re-export of [`ra-cloudflare-d1`](https://www.npmjs.com/package/ra-cloudflare-d1) — both workers speak the same Simple-REST dialect, so a single provider implementation serves either backend. Importing from `ra-turso` keeps a clean, Turso-only public surface.

## Install

```bash
pnpm add ra-turso
```

## Usage

```ts
import { Admin, Resource, ListGuesser } from "react-admin";
import { createTursoDataProvider } from "ra-turso";

const dataProvider = createTursoDataProvider({
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

## License

MIT
