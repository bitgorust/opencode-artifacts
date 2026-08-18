# Evidence: Install the artifact skill through official discovery

Add one section for every affected requirement ID. Link syntax is
`[@test](path)`, `[@manual](path)`, or `[@model](path)` and targets must exist before archive.
Do not hide failed or excluded results.

## Requirement: OC-05
- Validation: the native stable host advertises and loads the installed skill on demand.
- Verification: official frontmatter and project/global discovery paths are unit-tested; final
  exact-tarball stable `/skill` returned the installed description, location, and full body.
- Result: pass after candidate source-package removal.
- Evidence: [@manual](docs/evidence/opencode-host-verification.md)

## Requirement: DIST-01
- Validation: the exact tarball carries every file the explicit installer needs.
- Verification: installer source is an exact three-file inventory resolved relative to packed
  runtime code; CI removes the source package before native load verification.
- Result: pass in the final packed VPS rehearsal; CI repeats the same source-removal gate.
- Evidence: [@test](.github/workflows/ci.yml)

## Requirement: DIST-02
- Validation: project/global official paths work from clean state and fail safely on collision.
- Verification: tests cover project/global, idempotence, collision, exact force, retained
  backup, symlink refusal, unexpected inventory, and source removal. README documents all paths.
- Result: pass.
- Evidence: [@manual](README.md)
