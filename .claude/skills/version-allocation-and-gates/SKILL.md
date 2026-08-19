---
name: version-allocation-and-gates
description: >
  Use this skill whenever working in the talentOS repo and about to (a) assign or bump a
  code or documentation version number, (b) push, merge, fast-forward, or force-push commits
  to a remote branch, or (c) start the versioned documentation-update process (the plan, test
  results, and any of Data_Model, Data_Dictionary, Architecture, Decision_Log, Deployment,
  Regression_Scenarios, or Testing_Strategy docs). This encodes talentOS's AGENTS.md rules,
  which override default behavior: version numbers must be computed from origin/main AND all
  active unmerged remote branches, not just the local checkout, and re-verified right before
  the final push; and two specific actions — starting the doc-update process, and any push to
  a remote branch — require explicit user confirmation before proceeding, even if the user's
  original request seems to imply it. Trigger this proactively the moment you're about to write
  a version string, edit Version_Baseline.md, run `git push`/`git merge`, or open any of the
  docs above for a versioned iteration — don't wait to be asked.
---

# Version allocation and confirmation gates (talentOS)

This repo's `AGENTS.md` defines two mandatory, repo-specific rules that sit on top of normal
git/versioning judgment. Both exist because this repo has multiple agents and contributors
working on parallel unmerged branches, each of which may have already claimed a version number
or documentation slot that isn't visible from `origin/main` alone. Skipping either rule risks a
version collision or a merge that the user didn't actually sign off on.

Read `AGENTS.md` at the repo root before acting — this file summarizes it, but `AGENTS.md` is
the source of truth if the two ever diverge (e.g. after a future edit).

## 1. Version allocation

Do this **before** assigning or changing any code or documentation version — not after you've
already written the number down somewhere.

**Run the script first**: `node .claude/skills/version-allocation-and-gates/scripts/allocate-version.js`
(from anywhere inside the repo) does steps 1-8 below in one shot — it fetches origin, reads the
version declared on `origin/main` and every active unmerged remote branch, and prints the highest
version found plus the next available patch version. It does not decide which branches are
"abandoned or backup-only" (step 4) — use its "last commit" column for that judgment call
yourself. Re-run it again right before the final push/merge (step 9); the steps below are what it
automates, useful if the script fails or you need to sanity-check its output by hand.

1. `git fetch origin --prune`
2. Read the latest allocated version from `origin/main`.
3. List active unmerged remote branches: `git branch -r --no-merged origin/main`
4. Exclude from that list: `origin/HEAD`, `origin/main`, branches already merged into
   `origin/main`, and branches you can verify are abandoned/backup-only.
5. For each remaining branch, check its versioned documentation (or other authoritative version
   declaration, e.g. `Version_Baseline.md`) to see what version it has already claimed.
6. Take the highest version found across `origin/main` and all those branches.
7. Assign the **next patch version** after that highest version — not after whatever
   `origin/main` alone says.

   Example: `origin/main` = v0.18.3, `origin/feature-a` = v0.18.4, `origin/feature-b` = v0.18.5
   → next available version = v0.18.6.

8. Never reuse a version number that already exists on any active remote branch, even if it
   isn't yet on `origin/main`.
9. Immediately before the final push or merge, redo the check: fetch `origin` again, integrate
   the latest `origin/main`, resolve conflicts, rerun validation, and recompute the version —
   another branch may have claimed a version while you were working.
10. Branch policy while doing this:
    - a private, unpublished feature branch may be rebased freely;
    - a shared or already-published branch should normally be updated by merging
      `origin/main` in, not by rewriting its history;
    - never force-push without the user's explicit approval, regardless of whose branch it is.

## 2. Confirmation gates

Two actions require stopping and asking the user for explicit confirmation first, even if the
broader task already implies they'll happen eventually. Don't infer consent from an earlier,
more general instruction — ask again at the point of the specific action.

- **Starting the documentation-update process for a versioned iteration** — i.e. beginning to
  create or update the plan, test results, or any of Data_Model, Data_Dictionary, Architecture,
  Decision_Log, Deployment, Regression_Scenarios, or Testing_Strategy. Ask before you start
  drafting any of these, not after you've already written most of them.
- **Pushing commits to a remote branch** — including fast-forward pushes and force-pushes.
  Local commits, staging, and diff review don't require this gate; the gate is specifically the
  `git push` (or equivalent) to a remote.

`AGENTS.md` states this without exception: "Do not proceed until the user confirms." A general
instruction earlier in the conversation ("ship this", "get it merged") is not itself that
confirmation — ask again at the point you're actually about to start the doc-update process or
run the push, even if it seems implied by what was said before.
