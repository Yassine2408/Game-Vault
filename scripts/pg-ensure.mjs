/**
 * GameVault — embedded PostgreSQL manager.
 *
 * Runs a REAL PostgreSQL server locally (npm-hosted binaries, PostgreSQL 18.6)
 * so the development sandbox uses the exact same database engine as NeonDB.
 * In production, point DATABASE_URL at your Neon connection string and this
 * script simply becomes a no-op for the local server (see README → NeonDB).
 *
 * Idempotent: safe to run before every `next dev` / `prisma db push`.
 *  - already running          → exit immediately
 *  - data dir missing         → initdb + start + create database
 *  - data dir exists          → start (daemonised via pg_ctl, survives parent)
 */
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import pg from "pg";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BIN = path.join(ROOT, "node_modules/@embedded-postgres/linux-x64/native/bin");
const DATA_DIR = process.env.PGDATA_DIR || path.join(ROOT, "db/pgdata");
const LOG_FILE = path.join(ROOT, "db/postgres.log");
const PORT = Number(process.env.PGPORT || 5432);
const HOST = "127.0.0.1";
const USER = "postgres";
const DB_NAME = "gamevault";

function readSavedConnection() {
  try {
    const value = fs.readFileSync(path.join(ROOT, ".env"), "utf8")
      .match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\s]+)/m)?.[1];
    return value && /^postgres(ql)?:\/\//.test(value) ? new URL(value) : null;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

/**
 * Self-heal .env — sandbox recycles can revert it to the scaffold's stale
 * SQLite URL or drop keys entirely, which then aborts `prisma db push` and
 * prevents the dev server from ever starting. We only rewrite keys that are
 * missing or wrong; AUTH_SECRET is preserved if already set (rotating it
 * would invalidate all user sessions).
 */
function ensureEnvFile(connectionUrl) {
  const envPath = path.join(ROOT, ".env");
  let lines = [];
  try {
    lines = fs.readFileSync(envPath, "utf8").split("\n");
  } catch {
    lines = [];
  }

  const get = (key) => {
    for (const line of lines) {
      const m = line.match(/^\s*"?'?([A-Z0-9_]+)"?'?\s*=\s*(.*)\s*$/);
      if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, "");
    }
    return undefined;
  };

  const authSecret = get("AUTH_SECRET") || crypto.randomBytes(32).toString("hex");

  const wanted = {
    DATABASE_URL: connectionUrl,
    DIRECT_URL: connectionUrl,
    AUTH_SECRET: authSecret,
    AUTH_COOKIE_NAME: "gv_session",
  };

  const filtered = lines.filter(
    (line) => !/^\s*(DATABASE_URL|DIRECT_URL|AUTH_SECRET|AUTH_COOKIE_NAME)\s*=/.test(line)
  );
  const rebuilt = [
    "# GameVault — database & auth (auto-maintained by scripts/pg-ensure.mjs)",
    "# Local dev  → embedded PostgreSQL 18 (same engine as NeonDB)",
    "# Production → replace with your Neon connection string (see README → NeonDB)",
    ...Object.entries(wanted).map(([k, v]) => `${k}=${v}`),
    ...filtered.filter((l) => l.trim() && !l.startsWith("# GameVault — database & auth")),
  ];
  fs.writeFileSync(envPath, rebuilt.join("\n").trimEnd() + "\n");
  console.log("[pg] .env verified (DATABASE_URL / DIRECT_URL / AUTH_SECRET / AUTH_COOKIE_NAME)");
}

const isTcpReady = (host, port, timeoutMs = 900) =>
  new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (ok) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(timeoutMs, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });

const waitUntilReady = async (tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (await isTcpReady(HOST, PORT)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};

function run(bin, args, opts = {}) {
  execFileSync(path.join(BIN, bin), args, {
    stdio: opts.quiet ? "pipe" : "inherit",
    env: { ...process.env, LC_ALL: "C" },
    ...opts,
  });
}

const DATA_DIRS = [
  "pg_notify",
  "pg_replslot",
  "pg_serial",
  "pg_snapshots",
  "pg_stat",
  "pg_stat_tmp",
  "pg_tblspc",
  "pg_twophase",
  "pg_commit_ts",
  "pg_dynshmem",
  "pg_logical/mappings",
  "pg_logical/snapshots",
  "pg_multixact/members",
  "pg_multixact/offsets",
  "pg_wal/archive_status",
];

/**
 * After an unclean shutdown (e.g. sandbox recycle) some transient runtime
 * directories can disappear from the data dir, which prevents PostgreSQL from
 * starting ("could not open directory ..."). They carry no persistent data,
 * so we simply recreate them before starting the server.
 */
function repairDataDir() {
  if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) return;
  let fixed = 0;
  for (const dir of DATA_DIRS) {
    const p = path.join(DATA_DIR, dir);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true, mode: 0o700 });
      fixed++;
    }
  }
  // directory permissions get clobbered by snapshot restores too
  try { fs.chmodSync(DATA_DIR, 0o700); } catch {}
  for (const dir of DATA_DIRS) {
    try { fs.chmodSync(path.join(DATA_DIR, dir), 0o700); } catch {}
  }
  for (const f of ["PG_VERSION", "postgresql.conf", "postgresql.auto.conf", "pg_hba.conf", "pg_ident.conf"]) {
    try { fs.chmodSync(path.join(DATA_DIR, f), 0o600); } catch {}
  }
  // remove stale pid file — pg_ctl can't recover from a recycled host
  try {
    const pidPath = path.join(DATA_DIR, "postmaster.pid");
    if (fs.existsSync(pidPath)) {
      const pid = Number(fs.readFileSync(pidPath, "utf8").split("\n")[0]);
      try { process.kill(pid, 0); } catch { fs.unlinkSync(pidPath); }
    }
  } catch {}
  if (fixed) console.log(`[pg] repaired ${fixed} missing runtime directorie(s)`);
}

async function main() {
  // An explicitly configured PostgreSQL server can be used on any platform.
  const configuredUrl = process.env.DATABASE_URL;
  if (configuredUrl && /^postgres(ql)?:\/\//.test(configuredUrl)) {
    console.log("[pg] using configured PostgreSQL");
    return;
  }
  const saved = readSavedConnection();
  if (saved && (saved.hostname !== HOST || saved.port !== String(PORT) ||
      saved.username !== USER || saved.pathname !== `/${DB_NAME}`)) {
    console.log("[pg] using PostgreSQL configured in .env");
    return;
  }
  const password = saved?.password ? decodeURIComponent(saved.password) : crypto.randomBytes(32).toString("hex");
  const connectionUrl = `postgresql://${USER}:${encodeURIComponent(password)}@${HOST}:${PORT}/${DB_NAME}?schema=public`;
  if (!fs.existsSync(BIN)) {
    throw new Error("Embedded PostgreSQL requires Linux x64. Set DATABASE_URL to an existing PostgreSQL server or run the dev setup in WSL.");
  }

  // .env must always be valid before prisma/next run
  ensureEnvFile(connectionUrl);

  // 0) Nothing to do if something already listens on the port
  if (await isTcpReady(HOST, PORT)) {
    console.log("[pg] PostgreSQL already running on", `${HOST}:${PORT}`);
    await ensureDatabase(password);
    return;
  }

  // 1) Initialise a fresh cluster if needed
  repairDataDir();
  const fresh = !fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
  if (fresh) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.chmodSync(DATA_DIR, 0o700);
    const pwfile = path.join(ROOT, "db/.pgpw");
    fs.writeFileSync(pwfile, password, { mode: 0o600 });
    console.log("[pg] initialising cluster at", DATA_DIR);
    run("initdb", ["-D", DATA_DIR, "-U", USER, "-A", "password", "--pwfile", pwfile, "-E", "UTF8", "--locale=C"], { quiet: false });
    fs.unlinkSync(pwfile);
  }

  // 2) Start the server (pg_ctl daemonises → survives this script)
  console.log("[pg] starting PostgreSQL 18.6 …");
  try {
    run("pg_ctl", ["-D", DATA_DIR, "-l", LOG_FILE, "-o", `-h ${HOST} -p ${PORT} -c unix_socket_directories=''`, "-w", "-t", "30", "start"]);
  } catch (e) {
    // "already running" races or stale locks — verify before failing
    if (!(await isTcpReady(HOST, PORT))) {
      console.error("[pg] failed to start PostgreSQL:", e.message);
      console.error("[pg] see log:", LOG_FILE);
      process.exit(1);
    }
  }

  if (!(await waitUntilReady())) {
    console.error("[pg] server did not become ready in time");
    process.exit(1);
  }
  console.log("[pg] ready on", `${HOST}:${PORT}`);

  await ensureDatabase(password);
}

async function ensureDatabase(password) {
  const client = new pg.Client({ host: HOST, port: PORT, user: USER, password, database: "postgres" });
  await client.connect();
  const { rows } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
  if (!rows.length) {
    console.log(`[pg] creating database "${DB_NAME}"`);
    await client.query(`CREATE DATABASE ${DB_NAME}`);
  }
  await client.end();
}

main()
  .catch((e) => {
    console.error("[pg] fatal:", e);
    process.exit(1);
  });
