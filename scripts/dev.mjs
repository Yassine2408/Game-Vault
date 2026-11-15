import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const setup = spawnSync(process.execPath, ["scripts/pg-ensure.mjs"], { cwd: root, stdio: "inherit" });
if (setup.status !== 0) process.exit(setup.status ?? 1);

const flags = process.argv.slice(2)
  .filter((flag) => flag !== "--strictPort")
  .map((flag) => flag.replace(/^--host(?==|$)/, "--hostname"));
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...flags], {
  cwd: root,
  stdio: "inherit",
});
app.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
app.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => app.kill(signal));
}
