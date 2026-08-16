# Releasing

Publishing uses npm trusted publishing (OIDC) — no long-lived tokens. The publish workflow
(`.github/workflows/publish.yml`) runs on version tags and produces provenance attestations
automatically (public repo + public package).

## Setup (completed)

The package was first published manually (`npm publish --otp`), then the trusted publisher
was linked on npmjs.com (GitHub Actions: `bitgorust/opencode-artifacts`, workflow
`publish.yml`, action `npm publish`). An authenticated `npm trust list` readback verified that
exact repository/workflow binding and `createPackage` permission on 2026-08-16. These setup
steps do not normally need repeating; they are recorded here for forks:

1. First publish is manual (the package must exist before a trusted publisher can be linked):

   ```bash
   npm publish --otp <code-from-your-authenticator>
   ```

2. Link the trusted publisher: npmjs.com → package → Settings →
   Trusted Publisher → GitHub Actions, with repository and workflow filename (exact, case-sensitive).
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
