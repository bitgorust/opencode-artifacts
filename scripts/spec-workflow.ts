#!/usr/bin/env node

import { relative, resolve } from "node:path";
import {
  archiveChange,
  scaffoldChange,
  validateChange,
  type ChangeLane,
  type ValidationPhase,
} from "./spec-workflow-lib.ts";

const root = resolve(import.meta.dirname, "..");

function usage(): never {
  console.error(`Usage:
  npm run spec -- new <change-id> --lane <standard|high-risk> [--title <title>]
  npm run spec -- validate <change-id> [--phase <structure|proposal|implementation|archive>]
  npm run spec -- archive <change-id>`);
  process.exit(2);
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) usage();
  return value;
}

async function main(): Promise<void> {
  const [command, id, ...args] = process.argv.slice(2);
  if (!command || !id) usage();

  if (command === "new") {
    const laneValue = flag(args, "--lane") ?? "standard";
    if (laneValue !== "standard" && laneValue !== "high-risk") usage();
    const directory = await scaffoldChange(root, id, laneValue as ChangeLane, flag(args, "--title"));
    console.log(`created ${relative(root, directory)}`);
    console.log(`next: edit the packet, then npm run spec -- validate ${id} --phase proposal`);
    return;
  }
  if (command === "validate") {
    const phaseValue = flag(args, "--phase") ?? "structure";
    if (!["structure", "proposal", "implementation", "archive"].includes(phaseValue)) usage();
    const errors = await validateChange(root, id, phaseValue as ValidationPhase);
    if (errors.length > 0) {
      console.error(`change ${id} failed ${phaseValue} validation:`);
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
      return;
    }
    console.log(`change ${id} passed ${phaseValue} validation`);
    return;
  }
  if (command === "archive") {
    const directory = await archiveChange(root, id);
    console.log(`archived ${relative(root, directory)}`);
    return;
  }
  usage();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
