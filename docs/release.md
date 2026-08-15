# Releasing

Publishing uses npm trusted publishing (OIDC) — no long-lived tokens. The publish workflow
(`.github/workflows/publish.yml`) runs on version tags and produces provenance attestations
automatically (public repo + public package).

## One-time setup

1. First publish is manual (the package must exist before a trusted publisher can be linked):

   ```bash
   npm publish --otp <code-from-your-authenticator>
   ```

2. Link the trusted publisher: npmjs.com → package `opencode-artifacts` → Settings →
   Trusted Publisher → GitHub Actions:
   - Organization or user: `bitgorust`
   - Repository: `opencode-artifacts`
   - Workflow filename: `publish.yml` (filename only, case-sensitive)
   - Allowed actions: `npm publish`
3. Then harden: package Settings → Publishing access → "Require two-factor authentication
   and disallow tokens".

## Releasing

```bash
git tag v<x.y.z>   # must match package.json version
git push origin v<x.y.z>
```

The workflow installs, builds, tests, runs the structural checks, and publishes with
provenance. Watch it with `gh run watch`.

## Notes

- npm v12 install-time defaults (no lifecycle scripts, no git/remote deps) don't affect this
  package: no dependency needs them, and `prepublishOnly` is a publish-time script.
- If the trusted publisher errors with ENEEDAUTH, the workflow filename/repo fields are
  case-sensitive and must match exactly.
