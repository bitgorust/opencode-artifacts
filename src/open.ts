import { spawn } from "node:child_process";

export function openFile(path: string): void {
  try {
    const platform = process.platform;
    const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
    const args =
      platform === "darwin" ? [path] : platform === "win32" ? ["/c", "start", "", path] : [path];
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Opening a browser is best-effort; failing to open must never break publishing.
  }
}
