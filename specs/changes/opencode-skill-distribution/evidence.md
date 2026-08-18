# Evidence: Install the artifact skill through official discovery

Add one section for every affected requirement ID. Link syntax is
`[@test](path)`, `[@manual](path)`, or `[@model](path)` and targets must exist before archive.
Do not hide failed or excluded results.

## Requirement: OC-05
- Validation: the native stable host advertises and loads the installed skill on demand.
- Verification: planned frontmatter, permission, discovery, and load observation.
- Result: pending implementation.
- Evidence: [@manual](docs/evidence/opencode-host-verification.md)

## Requirement: DIST-01
- Validation: the exact tarball carries every file the explicit installer needs.
- Verification: planned packed-file and clean-install assertions.
- Result: pending implementation.
- Evidence: [@test](.github/workflows/ci.yml)

## Requirement: DIST-02
- Validation: project/global official paths work from clean state and fail safely on collision.
- Verification: planned installer matrix plus README-only clean-host flow.
- Result: pending implementation.
- Evidence: [@manual](README.md)
