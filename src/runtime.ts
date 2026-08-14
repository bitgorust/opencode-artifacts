import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, sep } from "node:path";

export type RuntimeName = "vega" | "vega-embed" | "echarts";

const BUNDLES: Record<RuntimeName, { pkg: string; file: string }> = {
  vega: { pkg: "vega", file: "build/vega.min.js" },
  "vega-embed": { pkg: "vega-embed", file: "build/vega-embed.min.js" },
  echarts: { pkg: "echarts", file: "dist/echarts.min.js" },
};

const require = createRequire(import.meta.url);
const cache = new Map<RuntimeName, string>();

function packageRoot(pkg: string): string {
  const entry = require.resolve(pkg);
  const parts = entry.split(sep);
  const nm = parts.lastIndexOf("node_modules");
  if (nm === -1) throw new Error(`cannot locate package root for ${pkg} from ${entry}`);
  const segments = pkg.startsWith("@") ? 2 : 1;
  return parts.slice(0, nm + 1 + segments).join(sep);
}

export function runtimeBundle(name: RuntimeName): string {
  const hit = cache.get(name);
  if (hit !== undefined) return hit;
  const { pkg, file } = BUNDLES[name];
  const code = readFileSync(join(packageRoot(pkg), file), "utf8");
  const wrapped = `/* runtime:${name} */\n${code}`;
  cache.set(name, wrapped);
  return wrapped;
}
