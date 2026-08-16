---
title: Incident 4172 — Checkout latency spike
icon: 🚨
source: Incident timeline, payment deploy log, latency injection, and ledger checks captured 2026-08-15
---

Checkout p99 peaked at 2.6 seconds and timeouts reached 2.1% for 38 minutes.

## Primary finding

The `svc-payments@1.88.0` deploy added a synchronous fraud check to the hot path. Injecting
800 ms of fraud-service latency reproduced the spike; rolling back to 1.87.2 restored p99.

```callout
{ "tone": "info", "title": "Next action", "body": "Implement PAY-2210: run the fraud check asynchronously with a 200 ms budget and default-allow on timeout." }
```
