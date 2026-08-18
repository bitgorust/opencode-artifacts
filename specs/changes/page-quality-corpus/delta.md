# Specification delta: Establish the canonical page-quality corpus

## MODIFIED

### Requirement: RENDER-11

The normal Markdown/component path covers a versioned corpus of exactly the eight normative
task families. Each bundle includes an exact neutral prompt, permission-safe sources, required
and forbidden facts, reader/decision, interactions, stress cases, provenance, and stable hashes.

#### Scenario: Normal behavior
- **Given:** the complete frozen corpus
- **When:** its normalized fixtures pass preflight and render
- **Then:** all eight task families and their required facts/interactions are represented without raw HTML

#### Scenario: Failure or refusal
- **Given:** a bundle has an invented/ambiguous fact, unsafe path, missing license, or incomplete rubric
- **When:** corpus validation runs
- **Then:** the bundle and any benchmark using it are refused with a stable diagnostic

#### Scenario: Relevant boundary
- **Given:** a source, prompt, or expected fact changes after a corpus version is frozen
- **When:** hashes are checked
- **Then:** the mismatch fails and requires a new version rather than rewriting prior evidence

### Requirement: QUAL-07

Page-quality evidence binds every generation and interaction trace to an exact validated corpus
version and source commit; exploratory or incomplete runs cannot enter a release denominator.

#### Scenario: Normal behavior
- **Given:** a capture manifest references a valid bundle
- **When:** evidence is prepared
- **Then:** exact prompt, input hashes, task, viewport, interaction, and expected hard gates are available

#### Scenario: Failure or refusal
- **Given:** a capture omits or changes corpus material
- **When:** evidence validation runs
- **Then:** it is excluded visibly and cannot support a quality claim

#### Scenario: Relevant boundary
- **Given:** all local fixtures pass but no authorized reference exists
- **When:** corpus status is reported
- **Then:** pattern coverage may pass while equal-or-better remains unverified

### Requirement: DIST-07

Every corpus input and retained output has explicit source provenance, redistribution status,
and a content hash; private or ambiguous third-party material remains outside distributable files.

#### Scenario: Normal behavior
- **Given:** synthetic project-owned corpus content
- **When:** distribution inventory runs
- **Then:** its license, attribution, source, and exact hash are recorded

#### Scenario: Failure or refusal
- **Given:** content lacks redistribution authority or contains private data
- **When:** it is proposed for the corpus or package
- **Then:** validation refuses inclusion and reports the offending inventory entry

#### Scenario: Relevant boundary
- **Given:** an authorized private reference may be reviewed but not redistributed
- **When:** benchmark evidence is retained
- **Then:** only permitted metadata/digests and aggregate results enter git or the package
