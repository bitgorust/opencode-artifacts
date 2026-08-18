export const PERMISSION_ORDER = [
  "artifact_publish",
  "artifact_datasource",
  "artifact_deploy",
  "artifact_audience",
] as const;

export type ModelPermission = typeof PERMISSION_ORDER[number];
export type ModelDecision = "allow" | "ask-approved" | "deny";

export interface PermissionModelInput {
  datasource: boolean;
  deploy: boolean;
  decisions: Partial<Record<ModelPermission, ModelDecision>>;
  autoAllow?: boolean;
}

export interface PermissionModelResult {
  requested: ModelPermission[];
  reached: ModelPermission[];
  denied?: ModelPermission;
  canMutate: boolean;
}

export function evaluatePermissionModel(input: PermissionModelInput): PermissionModelResult {
  const requested: ModelPermission[] = ["artifact_publish"];
  if (input.datasource) requested.push("artifact_datasource");
  if (input.deploy) requested.push("artifact_deploy", "artifact_audience");
  const reached: ModelPermission[] = [];
  for (const permission of requested) {
    reached.push(permission);
    const explicit = input.decisions[permission];
    const decision = explicit ?? (input.autoAllow ? "allow" : "deny");
    if (decision === "deny") return { requested, reached, denied: permission, canMutate: false };
  }
  return { requested, reached, canMutate: true };
}
