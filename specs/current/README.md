# Current specifications

Files in this directory describe observable behavior that is known to ship. They are not the
target roadmap and must not claim planned behavior.

Use one bounded domain per `<domain>.spec.md`. Each normative statement should include the
relevant product requirement ID and link to current verification evidence. Record meaningful
failure and boundary behavior, not implementation trivia.

Current specifications are bootstrapped incrementally: the first standard or high-risk
change touching a domain creates or improves that domain's file. Archive validation requires
the updated files to be named in the packet metadata.
