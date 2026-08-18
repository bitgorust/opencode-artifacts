import { createHash } from "node:crypto";
import { basename } from "node:path";
import type { ToolContext } from "@opencode-ai/plugin";

export type ArtifactPermission =
  | "artifact_publish"
  | "artifact_datasource"
  | "artifact_deploy"
  | "artifact_audience";

export interface DataSourceAuthority {
  name: string;
  command: string;
  args?: string[];
}

export interface DeployAuthority {
  target: "github" | "cloudflare";
  coordinate: string;
}

export interface PublishAuthorityInput {
  slug: string;
  format: "markdown" | "html";
  trustedHtml: boolean;
  dataSources?: DataSourceAuthority[];
  deploy?: DeployAuthority;
}

export interface ArtifactPermissionRequest {
  permission: ArtifactPermission;
  patterns: string[];
  always: string[];
  metadata: Record<string, unknown>;
}

export class ArtifactPermissionDeniedError extends Error {
  readonly permission: ArtifactPermission;

  constructor(permission: ArtifactPermission) {
    super(`${permission} was not approved`);
    this.name = "ArtifactPermissionDeniedError";
    this.permission = permission;
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

export function artifactPermissionKey(slug: string): string {
  return `${slug.slice(0, 48)}:${digest(slug)}`;
}

function validateDataSources(sources: DataSourceAuthority[]): void {
  if (sources.length > 32) throw new Error("dataSources supports at most 32 registered sources");
  const names = new Set<string>();
  for (const source of sources) {
    if (!/^[a-z0-9-]{1,64}$/.test(source.name)) {
      throw new Error("datasource names must be 1-64 lowercase letters, digits, or hyphens");
    }
    if (names.has(source.name)) throw new Error(`datasource name '${source.name}' is duplicated`);
    names.add(source.name);
    const executable = basename(source.command);
    if (source.command.trim() === "" || executable === "" || executable.length > 128) {
      throw new Error(`datasource '${source.name}' has an invalid executable`);
    }
  }
}

function validateDeploy(deploy: DeployAuthority): void {
  if (deploy.coordinate.length === 0 || deploy.coordinate.length > 220) {
    throw new Error("deploy coordinate must contain 1-220 characters");
  }
  if (!/^[A-Za-z0-9._/@:+-]+$/.test(deploy.coordinate)) {
    throw new Error("deploy coordinate contains unsupported characters");
  }
}

export function publishPermissionRequests(input: PublishAuthorityInput): ArtifactPermissionRequest[] {
  const artifact = artifactPermissionKey(input.slug);
  const requests: ArtifactPermissionRequest[] = [{
    permission: "artifact_publish",
    patterns: [artifact],
    always: [artifact],
    metadata: { artifact, format: input.format, trustedHtml: input.trustedHtml },
  }];
  if (input.dataSources && input.dataSources.length > 0) {
    validateDataSources(input.dataSources);
    const names = input.dataSources.map((source) => source.name);
    const executables = input.dataSources.map((source) => basename(source.command));
    requests.push({
      permission: "artifact_datasource",
      patterns: names.map((name) => `${artifact}:${name}`),
      always: [],
      metadata: { artifact, capability: "datasource-execution", names, executables },
    });
  }
  if (input.deploy) {
    validateDeploy(input.deploy);
    const coordinateKey = `${input.deploy.target}:${digest(input.deploy.coordinate)}`;
    requests.push({
      permission: "artifact_deploy",
      patterns: [`${artifact}:${coordinateKey}`],
      always: [],
      metadata: {
        artifact,
        capability: "provider-deploy",
        target: input.deploy.target,
        coordinate: input.deploy.coordinate,
      },
    });
    requests.push({
      permission: "artifact_audience",
      patterns: [`${artifact}:public-static:${coordinateKey}`],
      always: [],
      metadata: {
        artifact,
        capability: "public-static",
        target: input.deploy.target,
        coordinate: input.deploy.coordinate,
        visibility: "public",
      },
    });
  }
  return requests;
}

export async function approvePublishPermissions(
  ctx: Pick<ToolContext, "ask">,
  input: PublishAuthorityInput,
): Promise<ArtifactPermissionRequest[]> {
  const requests = publishPermissionRequests(input);
  for (const request of requests) {
    try {
      await ctx.ask(request);
    } catch {
      throw new ArtifactPermissionDeniedError(request.permission);
    }
  }
  return requests;
}
