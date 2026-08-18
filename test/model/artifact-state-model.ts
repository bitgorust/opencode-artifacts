export interface ModeledState {
  revision: number;
  value: Record<string, string>;
  operations: Record<string, { input: string; revision: number }>;
}

export type ModeledMutationResult = "committed" | "stale" | "replayed" | "replay-conflict";

export function initialModeledState(): ModeledState {
  return { revision: 0, value: {}, operations: {} };
}

export function modelReplace(
  state: ModeledState,
  operationId: string,
  expectedRevision: number,
  input: Record<string, string>,
): { state: ModeledState; result: ModeledMutationResult } {
  const encoded = JSON.stringify(input);
  const replay = state.operations[operationId];
  if (replay) {
    return { state, result: replay.input === encoded ? "replayed" : "replay-conflict" };
  }
  if (state.revision !== expectedRevision) return { state, result: "stale" };
  const revision = state.revision + 1;
  return {
    state: {
      revision,
      value: { ...input },
      operations: { ...state.operations, [operationId]: { input: encoded, revision } },
    },
    result: "committed",
  };
}

export function modelDocument(
  state: ModeledState,
  operationId: string,
  id: string,
  expectedValue: string | undefined,
  nextValue: string | undefined,
): { state: ModeledState; result: ModeledMutationResult } {
  const input = JSON.stringify({ id, expectedValue, nextValue });
  const replay = state.operations[operationId];
  if (replay) return { state, result: replay.input === input ? "replayed" : "replay-conflict" };
  if (state.value[id] !== expectedValue) return { state, result: "stale" };
  const revision = state.revision + 1;
  const value = { ...state.value };
  if (nextValue === undefined) delete value[id];
  else value[id] = nextValue;
  return {
    state: {
      revision,
      value,
      operations: { ...state.operations, [operationId]: { input, revision } },
    },
    result: "committed",
  };
}
