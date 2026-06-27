// Cross-platform runner for the project's *.sh scripts so `pnpm backup`,
// `pnpm restore`, etc. work the same on Linux/macOS and Windows.
//
//   node scripts/run-sh.mjs <script.sh> [args...]
//
// Linux/macOS: runs the script under `bash`.
// Windows:     tries Git Bash (`bash` on PATH) first, then falls back to
//              `wsl bash`. Any extra args are forwarded to the script.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const [script, ...args] = process.argv.slice(2);

if (!script) {
  console.error("run-sh: usage: node scripts/run-sh.mjs <script.sh> [args...]");
  process.exit(2);
}
if (!existsSync(script)) {
  console.error(`run-sh: script not found: ${script}`);
  process.exit(2);
}

const run = (cmd, cmdArgs) =>
  spawnSync(cmd, cmdArgs, { stdio: "inherit", env: process.env });

let result;
if (process.platform !== "win32") {
  result = run("bash", [script, ...args]);
} else {
  // Prefer Git Bash if it's on PATH.
  result = run("bash", [script, ...args]);
  // Fall back to WSL when no native bash is available.
  if (result.error && result.error.code === "ENOENT") {
    const wslScript = script.replace(/\\/g, "/");
    result = run("wsl", ["bash", wslScript, ...args]);
  }
}

if (result.error) {
  if (result.error.code === "ENOENT") {
    console.error(
      "run-sh: no bash found to run the script.\n" +
        "Install Git Bash or WSL, or run it directly on a Linux host."
    );
  } else {
    console.error(`run-sh: ${result.error.message}`);
  }
  process.exit(1);
}
process.exit(result.status ?? 0);
