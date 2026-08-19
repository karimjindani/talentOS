#!/usr/bin/env node
/*
 * Rebuilds and (re)starts the talentOS local stack in a way that guarantees the running
 * app is actually the code on disk right now — not a cached Docker layer, a reused
 * container, a stale generated Prisma client, or an ops process still running old source.
 *
 * This repo has four independent places staleness can hide, and "docker compose up -d --build"
 * alone does not reliably bust all of them:
 *   1. Prisma Client   — generated from schema.prisma; stale if you forgot `db:generate`.
 *   2. Docker image     — `applicant`/`admin` are built from the root Dockerfile; Docker's layer
 *                         cache can reuse an old build stage.
 *   3. Docker container — even a freshly built image can be left running in an old container if
 *                         nothing forces recreation.
 *   4. Ops console       — apps/ops is host-run (tsx, not Dockerized, not built); if it's already
 *                         running, restarting it is the only way to pick up new source.
 * This script forces all four, then verifies each service actually answers, and prints each
 * container's real start time so you can visually confirm it was just recreated, not reused.
 *
 * Usage:
 *   node fresh-run.js                # applicant + admin + ops (default)
 *   node fresh-run.js applicant      # just the applicant container
 *   node fresh-run.js admin ops      # any subset of: applicant, admin, ops
 *
 * Uses execFileSync/spawn with argv arrays throughout (no shell string interpolation).
 */
const { execFileSync, spawn } = require('child_process');

const isWin = process.platform === 'win32';

// npm on Windows is npm.cmd, a batch file — Node cannot exec it directly via
// execFileSync/spawn without a shell. Route it through cmd.exe /c the same way this repo's own
// scripts/local/support.ts already does, rather than passing shell:true (which would put any
// interpolated value through full shell parsing instead of just cmd.exe's simpler quoting).
function commandForPlatform(command, args) {
  if (!isWin) return { command, args };
  return { command: 'cmd.exe', args: ['/d', '/s', '/c', [command, ...args].map(quoteForCmd).join(' ')] };
}

function quoteForCmd(value) {
  return /^[A-Za-z0-9_.:/\\-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;
}

function npm(args) {
  return commandForPlatform('npm', args);
}

const OPS_PORT = 3300;
const URLS = {
  applicant: 'http://lvh.me:3100',
  admin: 'http://lvh.me:3200',
  ops: `http://127.0.0.1:${OPS_PORT}`
};
const CONTAINER_NAMES = { applicant: 'talentos-applicant', admin: 'talentos-admin' };

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  return execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function runCapture(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, label, attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status > 0 && response.status < 500) {
        console.log(`  ${label} is up (HTTP ${response.status}) at ${url}`);
        return;
      }
    } catch {
      // retry
    }
    await delay(2000);
  }
  throw new Error(`${label} did not become reachable at ${url} after ${attempts * 2}s`);
}

function stopOpsIfRunning() {
  if (isWin) {
    try {
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `$pids = Get-NetTCPConnection -State Listen -LocalPort ${OPS_PORT} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) { Stop-Process -Id $p -Force }`
        ],
        { stdio: 'ignore' }
      );
      console.log(`  Stopped any process already listening on port ${OPS_PORT}.`);
    } catch {
      /* nothing was listening, or PowerShell unavailable — fine either way */
    }
    return;
  }
  try {
    const pids = runCapture('lsof', ['-ti', `tcp:${OPS_PORT}`]).split('\n').map((s) => s.trim()).filter(Boolean);
    for (const pid of pids) {
      try {
        execFileSync('kill', ['-9', pid]);
      } catch {
        /* already gone */
      }
    }
    if (pids.length) console.log(`  Stopped process(es) on port ${OPS_PORT}: ${pids.join(', ')}`);
  } catch {
    /* lsof not available or nothing listening — fine either way */
  }
}

function startOpsDetached() {
  const { command, args } = npm(['run', 'ops:start']);
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

function printContainerStart(name) {
  try {
    const startedAt = runCapture('docker', ['inspect', '-f', '{{.State.StartedAt}}', name]).trim();
    console.log(`  ${name} container started at: ${startedAt}`);
  } catch {
    console.log(`  ${name} container: could not inspect (is it running?)`);
  }
}

async function main() {
  const requested = process.argv.slice(2);
  const targets = requested.length ? requested : ['applicant', 'admin', 'ops'];
  for (const t of targets) {
    if (!['applicant', 'admin', 'ops'].includes(t)) {
      throw new Error(`Unknown target "${t}" — expected one of: applicant, admin, ops`);
    }
  }
  const dockerTargets = targets.filter((t) => t !== 'ops');

  console.log('\n== 1. Regenerating Prisma Client from the current schema ==');
  { const { command, args } = npm(['run', 'db:generate']); run(command, args); }

  if (dockerTargets.length) {
    console.log('\n== 2. Ensuring infra dependencies are up (no rebuild needed for these) ==');
    run('docker', ['compose', 'up', '-d', 'postgres', 'keycloak-postgres', 'keycloak', 'minio', 'minio-setup']);

    console.log(`\n== 3. Rebuilding [${dockerTargets.join(', ')}] with --no-cache (ignores Docker layer cache entirely) ==`);
    run('docker', ['compose', 'build', '--no-cache', ...dockerTargets]);

    console.log(`\n== 4. Force-recreating [${dockerTargets.join(', ')}] containers from the fresh image ==`);
    run('docker', ['compose', 'up', '-d', '--force-recreate', '--no-deps', ...dockerTargets]);
  }

  if (targets.includes('ops')) {
    console.log('\n== 5. Restarting the host-run Ops console (tsx, no build cache — a restart is enough) ==');
    stopOpsIfRunning();
    startOpsDetached();
  }

  console.log('\n== Verifying every target actually answers ==');
  for (const t of targets) {
    await waitForHttp(URLS[t], t);
  }

  console.log('\n== Container start times (confirms recreation, not reuse) ==');
  for (const t of dockerTargets) {
    printContainerStart(CONTAINER_NAMES[t]);
  }

  console.log('\nDone. Every rebuilt target is running the code currently on disk.');
}

main().catch((err) => {
  console.error('\nfresh-run.js failed:', err.message);
  process.exit(1);
});
