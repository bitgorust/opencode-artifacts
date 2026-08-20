# Local artifact core candidate: consumer verification

Date: 2026-08-18

Result: **pass for local byte verification; registry verification remains pending**

Candidate source commit: `84f866ed742eeb08ba668115342ef0e5896dead7`

Candidate archive: `opencode-artifacts-0.15.0.tgz`

## Exact coordinates

| Field | Value |
|---|---|
| SHA-256 | `f6d5d5dcdd74ac31522ec9a98acfb38a04c1a4a038c09e65d85d7f4813342bf2` |
| npm SHA-1 shasum | `9eeff3bbc6f016aaa2b10c71df15e891904a8ad0` |
| npm SRI | `sha512-ErzQBzSxNz/nuxsTfwi5uozrJvK5joo7c6SyHeWz9THM49ETSY5PajdrxdfXq0J86lGAK4HdahCKyEo1gPIjKA==` |
| Packed size | 126383 bytes |
| Unpacked size | 542885 bytes |
| Entries | 69 |

Two separate temporary destinations and npm caches produced archives with the same three
coordinates. `cmp` exited zero, so the archives were byte-identical. The resulting SHA-256
also equals the frozen candidate record and the exact tarball retained by GitHub Actions run
`32161443356`.

## Offline verification procedure

After obtaining the candidate archive through an authorized channel, a consumer can verify
its bytes without running package code:

```sh
sha256sum opencode-artifacts-0.15.0.tgz
sha1sum opencode-artifacts-0.15.0.tgz
tar -tzf opencode-artifacts-0.15.0.tgz
```

The first two outputs must equal the coordinates above. The archive listing must use only
`package/` paths and contain `package/package.json`, `package/README.md`, `package/dist/`,
`package/skills/`, `package/agents/`, and `package/LICENSE`.

The SRI can be checked with a local SHA-512 implementation:

```sh
openssl dgst -sha512 -binary opencode-artifacts-0.15.0.tgz | base64
```

Prefix the output with `sha512-` and compare the complete value above.

## Boundary

This is consumer-verifiable evidence for candidate bytes and reproducible packing. It does
not establish that npm served those bytes, that a registry signature exists, or that npm
provenance binds them to the intended tag, commit, and workflow. Those checks require an
authorized publication and registry readback, so the certification record's
`integrity-provenance` requirement remains pending and no provider mutation occurred.
