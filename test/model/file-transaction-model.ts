import type { TransactionFaultPoint } from "../../src/file-transaction.ts";

export type TransactionOutcome = "old" | "new";

const PRE_COMMIT_POINTS = new Set<TransactionFaultPoint>([
  "stage-created",
  "target-staged",
  "journal-prepared",
]);

export function modeledOutcome(point: TransactionFaultPoint): TransactionOutcome {
  return PRE_COMMIT_POINTS.has(point) ? "old" : "new";
}

export const ALL_TRANSACTION_FAULT_POINTS: TransactionFaultPoint[] = [
  "stage-created",
  "target-staged",
  "journal-prepared",
  "commit-decided",
  "target-backed-up",
  "target-replaced",
  "commit-verified",
  "journal-committed",
];
