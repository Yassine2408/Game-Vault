/**
 * GameVault — prisma db push wrapper.
 *
 * The sandbox shell can carry a stale DATABASE_URL (scaffold SQLite file) and
 * the Prisma CLI gives process.env precedence over .env — which aborts
 * `prisma db push` with P1012 / P1010. This wrapper reads the .env that
 * scripts/pg-ensure.mjs has just verified/repaired and spawns the Prisma CLI
 * with explicit, correct connection variables.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

function readEnvValues() {
  let raw;
  try {
    raw = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*(DATABASE_URL|DIRECT_URL|AUTH_SECRET|AUTH_COOKIE_NAME)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const envs = readEnvValues();
const externalUrl = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "") ? process.env.DATABASE_URL : null;
const databaseUrl = externalUrl || envs.DATABASE_URL;
if (!databaseUrl || !/^postgres(ql)?:\/\//.test(databaseUrl)) {
  console.error("[prisma-push] .env DATABASE_URL is not a PostgreSQL URL — run pg-ensure first");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["prisma", "db", "push", "--skip-generate"],
  {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: (externalUrl ? process.env.DIRECT_URL : envs.DIRECT_URL) || databaseUrl,
    },
  }
);

process.exit(result.status ?? 1);
