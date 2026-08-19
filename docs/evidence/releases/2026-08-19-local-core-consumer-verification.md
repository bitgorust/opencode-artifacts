# Local artifact core candidate: consumer verification — 2026-08-19

Result: **pass for local byte verification; registry verification remains pending**

Frozen product commit: `2908d52ef94bb0f8cf74d7f2be021ada78a0d661`

| Field | Value |
|---|---|
| Archive | `opencode-artifacts-0.15.0.tgz` |
| SHA-256 | `6d5d4df63bb2300f438a572fc0af4741b793489bbd630b55070c04987c67badd` |
| npm SHA-1 shasum | `9dbcd2f6d05e5984c698c97ec9524f0f21a237ef` |
| npm SRI | `sha512-X9IgvKCHvs1Q5QegNWoBcdId/tIkqlrF0dNSlfSPCCj2Lehrfbl+j4HF2QSVHUNtGFRpGMw6OhDYHLKKARDXfQ==` |
| Packed / unpacked | 126504 / 543313 bytes |
| Entries | 69 |

Two fresh local packs with isolated npm caches and the archive downloaded from GitHub Actions
run `32212321648` were compared. All three had the SHA-256 above and both `cmp` comparisons
exited zero. The Linux, macOS, and Windows platform jobs then installed that one downloaded
archive; they did not create platform-specific candidates.

Consumers can verify obtained bytes without running package code:

```sh
sha256sum opencode-artifacts-0.15.0.tgz
sha1sum opencode-artifacts-0.15.0.tgz
tar -tzf opencode-artifacts-0.15.0.tgz
openssl dgst -sha512 -binary opencode-artifacts-0.15.0.tgz | base64
```

The first two outputs must match the coordinates above. Prefix the final output with
`sha512-` and compare the complete SRI. The archive must contain only `package/` paths and the
declared package, README, license, `dist`, `skills`, and `agents` contents.

This proves reproducible candidate packing and consumer-verifiable bytes. It does not prove
that npm served them, that a registry signature exists, or that published npm provenance
binds them to an authorized release tag. The certification integrity row therefore remains
pending and provider mutation count remains zero.
