import { spawn } from "node:child_process";

function opener(path: string): { command: string; args: string[] } {
  const platform = process.platform;
  const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "darwin" ? [path] : platform === "win32" ? ["/c", "start", "", path] : [path];
  return { command, args };
}

export async function openFileChecked(path: string): Promise<void> {
  const selected = opener(path);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(selected.command, selected.args, { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export function openFile(path: string): void {
  try {
    void openFileChecked(path).catch(() => {});
  } catch {
    // Opening a browser is best-effort; failing to open must never break publishing.
  }
}
