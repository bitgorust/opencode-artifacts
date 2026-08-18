# Specification delta: Install the artifact skill through official discovery

## MODIFIED

### Requirement: OC-05

The packed `artifact-pages` skill has valid official frontmatter and an explicit installer for
project `.opencode/skills/artifact-pages` or global OpenCode configuration skill discovery. It
is advertised and loaded on demand subject to native skill permissions; proactive plugin mode
remains a separate explicit option.

#### Scenario: Normal behavior
- **Given:** a clean packed install and selected project or global scope
- **When:** the user runs the skill installer and starts stable OpenCode
- **Then:** the native skill tool advertises `artifact-pages` and can load its body/references

#### Scenario: Failure or refusal
- **Given:** the destination differs, is symlinked, escapes scope, or is not writable
- **When:** installation runs without exact force authorization
- **Then:** it refuses before replacement and reports the unchanged path and recovery action

#### Scenario: Relevant boundary
- **Given:** the identical complete skill is already installed
- **When:** installation repeats
- **Then:** it is an idempotent no-op and does not duplicate or broaden skill permissions

### Requirement: DIST-01

The exact npm tarball includes the skill body, required references, and installer source/runtime;
the installer resolves only those packed files and never depends on repository-only paths.

#### Scenario: Normal behavior
- **Given:** the generated tarball installed in an isolated prefix
- **When:** skill installation runs
- **Then:** every copied byte comes from the reviewed packed skill inventory

#### Scenario: Failure or refusal
- **Given:** a required packed skill file is missing or changed during inspection
- **When:** installation runs
- **Then:** no partial destination becomes selected and the command fails actionably

#### Scenario: Relevant boundary
- **Given:** the source package tree is removed after installation
- **When:** OpenCode loads the copied skill
- **Then:** the installed skill and references remain available from the official destination

### Requirement: DIST-02

Registry, official OpenCode plugin configuration, and local-development documentation each name
the explicit skill-install step, destination, safe collision behavior, and manual removal path.

#### Scenario: Normal behavior
- **Given:** a user follows only the packed-package README path
- **When:** they install the plugin and project-scoped skill
- **Then:** tools and native on-demand skill discovery work without a checkout

#### Scenario: Failure or refusal
- **Given:** an install command cannot safely finish
- **When:** it reports failure
- **Then:** documentation identifies the failing layer and retry/removal path without deleting user data

#### Scenario: Relevant boundary
- **Given:** a contributor uses a local checkout
- **When:** they choose the local-development workflow
- **Then:** documentation distinguishes it from registry and packed-host evidence
