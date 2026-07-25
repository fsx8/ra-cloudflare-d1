# d1-rest-worker

## 0.3.0

### Minor Changes

- [`eea3522`](https://github.com/fsx8/ra-cloudflare-d1/commit/eea352208cb637a120ad0c9ac4ca0d5542a478cb) Thanks [@fsx8](https://github.com/fsx8)! - Add optional rate limiting via Cloudflare's native Rate Limiting binding. Pass `rateLimit: { binding: env.API_RATE_LIMITER }` to `createD1RestApi` to enforce per-key request limits with zero latency overhead. Returns `429 RATE_LIMITED` when exceeded.

### Patch Changes

- Updated dependencies [[`eea3522`](https://github.com/fsx8/ra-cloudflare-d1/commit/eea352208cb637a120ad0c9ac4ca0d5542a478cb)]:
  - @ra-cloudflare-d1/types@0.3.0

## 0.2.0

### Minor Changes

- [`0c3b969`](https://github.com/fsx8/ra-cloudflare-d1/commit/0c3b96963e0914dc8c689225d54f8c1b7d18d664) Thanks [@fsx8](https://github.com/fsx8)! - Initial public release.

### Patch Changes

- Updated dependencies [[`0c3b969`](https://github.com/fsx8/ra-cloudflare-d1/commit/0c3b96963e0914dc8c689225d54f8c1b7d18d664)]:
  - @ra-cloudflare-d1/types@0.2.0
