# Authenticated hosting on Cloudflare (free tier)

The `cloudflare` deploy target publishes your artifact gallery to a Cloudflare Worker with a
KV-backed state store: workshop decisions, comments, and the mini-DB all work on the hosted
site — the same API surface as local `serve`, minus shell datasources (`/__data` returns 501,
since Workers can't run local commands).

Free-tier coverage: Workers (100k requests/day), KV (100k reads / 1k writes per day),
Workers Static Assets (included). Cloudflare Access is free for up to 50 users and adds
org-grade identity in front of the whole site.

## One-time setup

1. Install and authenticate wrangler:

   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. Deploy once from your project:

   ```bash
   opencode-artifacts deploy --target cloudflare --name my-artifacts
   ```

   This creates the `ARTIFACTS_KV` namespace (the id is cached in the staging dir), bundles
   the worker, uploads your gallery, and prints the `workers.dev` URL. Subsequent publishes
   from OpenCode: `artifact_publish` with `deploy: true, target: "cloudflare",
   workerName: "my-artifacts"`.

## Add identity (Cloudflare Access, free ≤ 50 users)

1. Cloudflare dashboard → Zero Trust → Access → Applications → Add → Self-hosted.
2. Point it at `my-artifacts.<your-subdomain>.workers.dev` (or your custom route).
3. Pick an auth method (one-time PIN email is zero-config; GitHub/Google IdP also free).
4. Now every viewer is authenticated; Access injects `Cf-Access-Authenticated-User-Email`
   headers the worker could use for comment authorship (roadmap).

## What works where

| Feature | file:// | local `serve` | GitHub Pages | Cloudflare Worker |
|---|---|---|---|---|
| Static page, charts, components | ✅ | ✅ | ✅ | ✅ |
| Live reload | — | ✅ | — | — |
| Decisions / comments / mini-DB | localStorage | ✅ (fs) | — | ✅ (KV) |
| Live datasources (`/__data`) | — | ✅ (local shell) | — | ❌ (501) |
| Public link | — | LAN only | ✅ | ✅ |
| Authenticated viewers | — | — | — | via Access |

## Notes

- KV is eventually consistent (edge-cached up to 60s); fine for comments/decisions, do not
  use it for counters that need strictness.
- Free-tier write limits make the mini-DB suitable for annotations, not telemetry.
