#!/usr/bin/env node
/*
 * Computes the next available patch version per talentOS AGENTS.md's Version Allocation
 * procedure: fetch origin, read the version declared on origin/main AND every active unmerged
 * remote branch, and assign the next patch after the highest one found.
 *
 * This automates AGENTS.md steps 1-8. It deliberately does NOT auto-exclude "abandoned or
 * backup-only" branches (step 4) — that's a judgment call the agent/user makes using the
 * "last commit" column this script prints. Re-run this script again immediately before the
 * final push/merge (AGENTS.md step 9), since another branch may have claimed a version meanwhile.
 *
 * Usage: node allocate-version.js
 *
 * Uses execFileSync (argv array, no shell) rather than exec/execSync throughout: branch names
 * come from remote refs, which anyone with push access to the repo can set to an arbitrary
 * string, so they must never be interpolated into a shell command line.
 */
const { execFileSync } = require('child_process');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function tryShow(ref, filePath) {
  try {
    return git(['show', `${ref}:${filePath}`]);
  } catch {
    return null;
  }
}

function extractVersion(content, pattern) {
  if (!content) return null;
  const m = content.match(pattern);
  return m ? m[1] : null;
}

function parseVersion(v) {
  const m = v && v.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function bestVersionForRef(ref) {
  const sdlc = tryShow(ref, 'docs/sdlc.md');
  const vSdlc = extractVersion(sdlc, /Current allocated iteration version:\s*`([^`]+)`/);

  const baseline = tryShow(ref, 'docs/Version_Baseline.md');
  const vBaseline = extractVersion(baseline, /^Version:\s*`([^`]+)`/m);

  const candidates = [
    vSdlc && { source: 'docs/sdlc.md', version: vSdlc },
    vBaseline && { source: 'docs/Version_Baseline.md', version: vBaseline },
  ].filter(Boolean);

  let best = null;
  for (const c of candidates) {
    const parsed = parseVersion(c.version);
    if (!parsed) continue;
    if (!best || compareVersions(parsed, best.parsed) > 0) {
      best = { ...c, parsed };
    }
  }
  return best;
}

function main() {
  console.log('Fetching origin...');
  git(['fetch', 'origin', '--prune']);

  const unmergedRaw = git(['branch', '-r', '--no-merged', 'origin/main', '--format=%(refname:short)']);
  const branches = unmergedRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== 'origin/HEAD' && l !== 'origin/main');

  const refs = ['origin/main', ...branches];

  const results = refs.map((ref) => {
    const best = bestVersionForRef(ref);
    let lastCommit = '(unknown)';
    try {
      lastCommit = git(['log', '-1', '--format=%cd %an', '--date=short', ref]).trim();
    } catch {
      /* ref may be unreadable; leave default */
    }
    return { ref, best, lastCommit };
  });

  console.log('\nRef'.padEnd(56) + 'Version'.padEnd(11) + 'Source'.padEnd(26) + 'Last commit');
  console.log('-'.repeat(110));
  let overallBest = null;
  for (const r of results) {
    const versionStr = r.best ? r.best.version : '(none found)';
    const sourceStr = r.best ? r.best.source : '-';
    console.log(r.ref.padEnd(56) + versionStr.padEnd(11) + sourceStr.padEnd(26) + r.lastCommit);
    if (r.best && (!overallBest || compareVersions(r.best.parsed, overallBest.parsed) > 0)) {
      overallBest = r.best;
    }
  }

  if (!overallBest) {
    console.log('\nNo version declaration found on any ref (docs/sdlc.md or docs/Version_Baseline.md).');
    console.log('Cannot compute next version automatically — check manually.');
    process.exit(1);
  }

  const [maj, min, pat] = overallBest.parsed;
  const next = `v${maj}.${min}.${pat + 1}`;

  console.log(`\nHighest allocated version found: ${overallBest.version}`);
  console.log(`Next available patch version:     ${next}`);
  console.log('\nBefore trusting this: review the branch list above for any that are actually');
  console.log('abandoned/backup-only (AGENTS.md step 4) — this script does not filter those out.');
  console.log('Re-run this script immediately before the final push/merge (AGENTS.md step 9).');
}

try {
  main();
} catch (err) {
  console.error('allocate-version.js failed:', err.message);
  if (err.stderr) console.error(String(err.stderr));
  process.exit(1);
}
