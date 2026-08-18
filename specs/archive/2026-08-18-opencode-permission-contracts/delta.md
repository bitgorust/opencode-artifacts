# Specification delta: Separate OpenCode artifact permissions

## MODIFIED

### Requirement: UX-03

Local artifact writes, datasource authority, provider deployment, and public audience expansion
use separate explicit scoped checkpoints. Repeated approval cannot broaden from one capability,
artifact, target, or visibility to another.

#### Scenario: Normal behavior
- **Given:** publication requests local write plus selected elevated capabilities
- **When:** validation and secret scanning pass
- **Then:** OpenCode asks for each requested scope with exact bounded metadata before mutation

#### Scenario: Failure or refusal
- **Given:** any required permission is denied, aborted, malformed, or unavailable
- **When:** the invocation runs
- **Then:** no filesystem/provider mutation occurs and the result names the denied layer and next action

#### Scenario: Relevant boundary
- **Given:** a prior local-write permission is remembered
- **When:** a later call adds datasource, deploy, or public-audience scope
- **Then:** the remembered grant does not authorize any added capability

### Requirement: OC-06

Stable OpenCode policy can independently set `allow`, `ask`, or `deny` for
`artifact_publish`, `artifact_datasource`, `artifact_deploy`, and `artifact_audience`.
Deployment metadata distinguishes artifact, target, capability, and visibility without secrets.

#### Scenario: Normal behavior
- **Given:** explicit permission rules for each artifact resource
- **When:** the stable host executes a matching publish request
- **Then:** each allow/ask decision is honored in deterministic order and audited by exact scope

#### Scenario: Failure or refusal
- **Given:** one resource is explicitly denied
- **When:** normal or auto mode executes the request
- **Then:** the deny remains effective and no later resource or side effect is reached

#### Scenario: Relevant boundary
- **Given:** only a local portable file is requested
- **When:** publication runs
- **Then:** no datasource, deploy, or audience permission is requested
