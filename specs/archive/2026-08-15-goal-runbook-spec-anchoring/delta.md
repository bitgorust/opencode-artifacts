# Specification delta: Keep goal orchestration anchored to canonical specs

## MODIFIED

### Requirement: OUT-06

The execution runbook partitions roadmap outcomes into bounded goals, but all exact phase
work, dependencies, risks, and exit gates remain canonically owned by the roadmap and linked
specialist records. A conflicting runbook summary never overrides its canonical owner.

#### Scenario: Normal goal routing

- **Given:** a maintainer starts a documented goal
- **When:** the agent loads its execution contract
- **Then:** the runbook supplies orchestration and links the exact canonical phase gate

#### Scenario: Conflicting summary

- **Given:** a runbook summary conflicts with a canonical requirement or gate
- **When:** the conflict is discovered
- **Then:** the canonical owner governs and the runbook is corrected before the claim proceeds

#### Scenario: Planning boundary

- **Given:** evidence changes the appropriate packet decomposition
- **When:** the active goal is planned
- **Then:** recommended packet boundaries may be split without changing the roadmap contract

### Requirement: QUAL-01

A proposal that will not be delivered can be withdrawn with actor, timestamp, and rationale.
Withdrawal is retained in the archive, does not update current shipped specifications, and
does not satisfy implementation, evidence, or release gates.

#### Scenario: Normal withdrawal

- **Given:** a draft or approved proposal will not be implemented
- **When:** a maintainer withdraws it with a reason
- **Then:** the packet moves to archive with its withdrawn disposition and rationale intact

#### Scenario: Invalid withdrawal

- **Given:** the actor or reason is empty, or the packet is already verified
- **When:** withdrawal is requested
- **Then:** the workflow refuses without moving or mislabeling the packet

#### Scenario: Archive boundary

- **Given:** archived history contains delivered and withdrawn packets
- **When:** structural validation runs
- **Then:** both dispositions validate distinctly and only delivered packets imply current truth
