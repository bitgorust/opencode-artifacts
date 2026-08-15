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

   This creates a worker-scoped `ARTIFACTS_KV_<worker-name>` namespace (the id is cached in
   the staging dir), bundles the worker, uploads your gallery, and prints the `workers.dev`
   URL. Subsequent publishes
   from OpenCode: `artifact_publish` with `deploy: true, target: "cloudflare",
   workerName: "my-artifacts"`.

   Published packages through 0.14.3 used one account-wide namespace named `ARTIFACTS_KV`.
   Existing Workers continue to serve their static pages and remain bound to that namespace
   until redeployed. The next release creates a worker-scoped namespace instead; it does not
   automatically copy old decisions, comments, or mini-DB documents. Export or copy any state
   you need before redeploying an older Worker. Static artifact HTML and the local manifest
   format are unchanged.

## Add identity (Cloudflare Access, free ≤ 50 users)

This is currently a manual operator step. Until Access is configured and verified, the
Workers URL is public; the package does not yet provide Claude-style private-by-default
sharing, roles, or revocation. See the authenticated-hosting phase in
[`docs/roadmap.md`](roadmap.md).

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

- Deploy-verified 2026-08-15: `https://opencode-artifacts.kenuyx7487.workers.dev` served the
  gallery and pages, and a workshop decision clicked in the browser round-tripped through KV
  (`/__state` read-back). Evidence: `docs/evidence/hosted-worker.png`.
- Three assets config keys are load-bearing and all easy to miss: `binding = "ASSETS"` (without
  it `run_worker_first` is ignored), `run_worker_first = true` (without it assets bypass the
  worker and never get the bridge injected), `html_handling = "none"` (without it `.html` URLs
  redirect-strip and change the slug the bridge derives).
- KV is eventually consistent (edge-cached up to 60s). The current implementation is useful
  for low-contention annotations but does not meet the product spec's concurrent-write gate;
  do not use it for counters or collaborative state that must not lose updates.
- Free-tier write limits make the mini-DB suitable for annotations, not telemetry.
