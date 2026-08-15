# ADR 0001: Use spec-anchored development

- Status: Accepted
- Date: 2026-08-15
- Decision owners: Project maintainers

## Context

OpenCode Artifacts has a normative target contract, an engineering rulebook, a roadmap,
tests, and release evidence. What it lacks is a durable unit that connects a proposed
behavior change to all of those records. That gap makes three failures too easy:

1. implementation can begin while important behavior is still ambiguous;
2. a target requirement can be mistaken for behavior that already ships; and
3. code, tests, current-state documentation, and release claims can drift apart.

The reviewed spec-driven-development approaches agree that specifications can improve agentic
work, but they make different tradeoffs. Spec Kit emphasizes a staged constitution → specify
→ plan → tasks → implement flow. OpenSpec uses compact proposal and delta-spec artifacts for
brownfield repositories. Tessl treats specifications as testable behavioral contracts.
Spec-as-source approaches go further and generate implementations from specifications.
Martin Fowler's review warns that rigid document pipelines can add ceremony, duplicate facts,
and turn generated plans into an illusion of correctness.

Formal methods add another useful distinction: prose and examples validate that the intended
behavior is the right one, while models, proofs, and exhaustive state exploration can verify
selected properties of the implementation design. They are valuable for small, dangerous
state spaces, but are not a substitute for user evaluation or visual-quality evidence.

## Decision

Use **spec-anchored development**: specifications are the stable anchors for intent and
observable behavior, while implementation remains maintained source code. Specifications do
not generate or replace the implementation.

The repository has four deliberately separate records:

| Record | Canonical question | Lifetime |
|---|---|---|
| `docs/product-spec.md` | What outcome and behavior is the product targeting? | long-lived target contract |
| `docs/engineering-principles.md` | What constraints govern engineering decisions? | long-lived rulebook |
| `specs/current/*.spec.md` | What observable behavior is known to ship now? | updated with behavior |
| `specs/changes/<id>/` | What approved delta is this change making, and what proves it? | proposal through verification, then archived |

The roadmap may sequence work but does not redefine requirements. Tests and evidence prove
claims but do not become the prose contract. Each fact has one canonical owner and other
records link to it.

### Risk-scaled lanes

Every change uses the lightest lane that preserves the contract:

| Lane | Use when | Required record |
|---|---|---|
| Trivial | no observable behavior or governed invariant changes, or a bug is restored to an already explicit current spec | code, test when behavior is exercised, and normal review; no packet |
| Standard | observable behavior, a public contract, or a normative requirement changes | proposal, delta, tasks, evidence, approval metadata |
| High-risk | security, privacy, authorization, concurrency, durability, migration, destructive action, public compatibility, or an irreversible decision changes | standard packet plus design record, risk analysis, rollback, and a formal-method decision |

If lane selection is uncertain, use the higher lane. Splitting a change to evade a lane is
not allowed.

### Change packet lifecycle

1. **Propose.** Scaffold a packet, name affected requirement IDs, describe the user outcome,
   non-goals, risks, rollback, and the intended current-spec deltas.
2. **Clarify and validate.** Mark unresolved decisions as `[NEEDS CLARIFICATION]`. Each active
   requirement has normal, failure, and relevant boundary scenarios. Do not implement through
   unresolved contract decisions.
3. **Approve.** A human records approval in `change.json`. Approval covers scope and contract,
   not just wording.
4. **Implement.** Work from ordered tasks. Keep delta scenarios, code, and tests aligned. If
   evidence contradicts the proposal, amend and reapprove it rather than silently changing
   the implementation target.
5. **Verify.** Record both validation evidence (the behavior solves the intended user problem)
   and verification evidence (the implementation satisfies the contract). Evidence links to
   exact tests, reports, manual protocols, or models.
6. **Update current truth and archive.** Update the affected `specs/current/` documents in the
   same change, mark tasks complete, set the packet to verified, validate it, and archive it.

Archived packets are decision history, not a second current specification. When history and
the current spec disagree, the latest approved current spec governs.

### Scenario and evidence rules

- Normative statements use requirement IDs from `docs/product-spec.md`.
- A delta groups requirements under `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED`.
- Scenarios state observable preconditions, action, and outcome; implementation detail belongs
  in design or tasks.
- Acceptance requires both validation and verification. A test can verify a requirement but
  cannot by itself prove that users wanted the behavior. A usability result can validate an
  outcome but cannot prove race freedom.
- Failed, excluded, and not-applicable evidence remains visible.

### Selective formal methods

A high-risk design explicitly records whether a formal method is useful. Use a state machine,
property model, model checker, or proof when the state space is bounded and failure is costly,
especially for:

- artifact identity, immutable revisions, restore, and migration;
- concurrent compare-and-swap and crash-safe multi-file transactions;
- filesystem path containment;
- authentication, authorization, visibility, and tenant/cache isolation; and
- connector retry, duplication, and idempotency.

Do not use formal notation as a proxy for page quality, usability, comprehension, or visual
comparison. Those require the browser, accessibility, journey, and blinded benchmark evidence
already defined by the product contract.

### Automation

The dependency-free `npm run spec` command scaffolds, validates, and archives packets. The
repository structural check validates the workflow files and all active packet structures.
Automation checks completeness and references; human review remains responsible for whether
the requirement is correct, the scenarios are meaningful, and the evidence is sufficient.

## Consequences

Benefits:

- agents and humans receive a bounded, approved contract for each meaningful change;
- target intent, shipped truth, proposed deltas, and proof cannot be conflated;
- brownfield adoption is incremental rather than requiring an unreliable full-system rewrite;
- high-risk work gains explicit rollback and formal-analysis decisions; and
- archived packets retain why a change happened without bloating the current specification.

Costs and risks:

- standard and high-risk changes require maintained documentation;
- approval can become a bottleneck if packets are oversized;
- mechanically complete scenarios can still be poor scenarios; and
- current specs can drift unless archive validation and review remain enforced.

Mitigations are small packets, risk-scaled lanes, machine checks for deterministic rules,
incremental current-spec coverage, and periodic review of whether the workflow is improving
lead time, defect escape, and review clarity.

## Alternatives considered

### Keep only the product spec and tests

Rejected because it provides no reviewable delta, approval point, or current-versus-target
separation for brownfield changes.

### Adopt spec-as-source

Rejected for now. Generating implementation from the contract would move correctness risk
into generators and constrain hand-maintained TypeScript without evidence that it improves
this repository. Reconsider only after repeated patterns demonstrate a stable generation
boundary and round-trip ownership is defined.

### Install Spec Kit, OpenSpec, or Tessl wholesale

Rejected for now. Their useful concepts are captured in a small repository-native workflow
without a new dependency or competing taxonomy. Reconsider if interoperability, team scale,
or external tooling creates a concrete benefit greater than migration and maintenance cost.

### Require formal models for every change

Rejected because proof effort should follow risk and model suitability. UI composition and
human outcomes need empirical validation, not more notation.

## Influences

- [Martin Fowler: exploring SDD tools](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [Kao Chen-long: spec as source](https://kaochenlong.com/sdd-spec-as-source)
- [Kao Chen-long: OpenSpec](https://kaochenlong.com/openspec)
- [GitHub: spec-driven development with Spec Kit](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [Tessl documentation](https://docs.tessl.io/)
- [github/spec-kit](https://github.com/github/spec-kit)
- [Formal methods overview](https://zh.wikipedia.org/zh-tw/%E5%BD%A2%E5%BC%8F%E5%8C%96%E6%96%B9%E6%B3%95)
- [NASA formal-methods guidance](https://ntrs.nasa.gov/api/citations/20040105661/downloads/20040105661.pdf)
- [Reviewed formal-methods paper](https://arxiv.org/pdf/2602.00180)
