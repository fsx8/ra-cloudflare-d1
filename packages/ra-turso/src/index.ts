// `ra-turso` is a thin, Turso-branded re-export of `ra-cloudflare-d1`.
// Both workers speak the same Simple-REST dialect, so a single provider
// implementation serves either backend. Turso consumers import from here to
// keep a clean, Turso-only public surface.
export { createD1DataProvider as createTursoDataProvider } from "ra-cloudflare-d1";
export type {
  D1ProviderOptions as TursoProviderOptions,
  D1DataProvider as TursoDataProvider,
} from "ra-cloudflare-d1";
