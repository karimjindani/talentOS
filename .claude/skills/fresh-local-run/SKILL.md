---
name: fresh-local-run
description: >
  Use this skill whenever building or running the talentOS local stack — starting the app to
  check a change, "seeing" a fix in the browser, running `docker compose up`, or verifying a
  feature end-to-end — and especially whenever the running app seems to still show old
  behavior/data after a code change ("it's still doing the old thing", "my change isn't showing
  up", "looks like it's using a cached build"). This is talentOS's project-specific answer to the
  generic `run` skill's "look for a project skill that already covers launching the app" step —
  prefer this one for talentOS. It exists because this repo has four independent places
  staleness can hide (a stale generated Prisma Client, Docker's image layer cache, a Docker
  container left running an old image, and the host-run Ops console needing a manual restart
  since it isn't rebuilt at all) and a plain `docker compose up -d --build` does not reliably
  bust all four. Trigger this proactively before telling the user a fix is verified in the
  running app, not only when they explicitly report stale behavior.
---

# Fresh local build & run (talentOS)

The goal here isn't just "run the app" — it's "run the app in a way you can trust actually
reflects the code on disk right now." That trust is the whole point; a rebuild that silently
reuses a stale layer is worse than no rebuild, because it looks successful while lying about what
it verified.

## Why a plain rebuild isn't enough here

This repo's local stack has four layers, and each one caches independently of the others:

1. **Prisma Client** (`node_modules/@prisma/client`) — generated from `schema.prisma`. If the
   schema changed and you didn't run `db:generate`, the app can be running against an old shape
   even though every other layer is fresh.
2. **Docker image** — `applicant` and `admin` build from the root `Dockerfile` (see
   `docker-compose.yml`). `docker compose build` (and plain `docker compose up --build`) reuse
   Docker's layer cache by default; that's normally fine, but it's exactly the mechanism that can
   leave you looking at old code when it misfires.
3. **Docker container** — a freshly built image doesn't help if the running container wasn't
   actually replaced. This is usually automatic when the image ID changes, but it's cheap to force
   and expensive to silently get wrong.
4. **Ops console** (`apps/ops`) — per this repo's local dev stack, Ops is host-run via
   `npm run ops:start`, not part of `docker-compose.yml`. It's a plain `tsx` process with no build
   step at all — if it's already running, the only way it picks up new source is a restart.

`docs/Deployment.md` documents rebuilding with `docker compose up -d --build applicant admin` as
the standard release procedure — that's correct for normal iteration. This skill is for the
stricter case: you need a **guarantee**, not just a rebuild, typically because something already
looked stale or you're about to tell the user a fix is confirmed working.

## Use the script

```
node .claude/skills/fresh-local-run/scripts/fresh-run.js [targets...]
```

- No args → `applicant`, `admin`, and `ops` (the full local app surface).
- Or name any subset: `node fresh-run.js admin`, `node fresh-run.js applicant ops`, etc.

It, in order:

1. Runs `npm run db:generate` so the Prisma Client matches the current schema.
2. Brings up infra dependencies (`postgres`, `keycloak`, `minio`, …) without rebuilding them —
   they're pulled images, not built from this repo.
3. Runs `docker compose build --no-cache` for the requested app(s) — ignores Docker's layer cache
   entirely, so there is no cached layer left that could serve old code.
4. Runs `docker compose up -d --force-recreate --no-deps` for the requested app(s) — replaces the
   running container even if Compose would otherwise think nothing changed.
5. For `ops`: stops whatever's listening on port 3300 (Windows via `Get-NetTCPConnection`/
   `Stop-Process`, POSIX via `lsof`/`kill`, matching `scripts/local/support.ts`'s existing
   convention) and starts it fresh, detached.
6. Waits for every requested target to actually answer HTTP, rather than assuming `docker compose
   up` succeeding means the app inside is healthy.
7. Prints each Docker container's real `StartedAt` timestamp — a concrete, checkable fact that it
   was just recreated, not reused. If you're verifying a fix, this is what to point to.

`--no-cache` makes this slower than a normal rebuild (a full `npm ci` + `next build` per app, no
shortcuts) — that's the deliberate tradeoff for "no cache" being a hard guarantee rather than a
best effort. For routine iteration where nothing looks wrong yet, a plain
`docker compose up -d --build applicant admin` is fine and much faster; reach for this script when
you specifically need to rule out staleness, not as the default every time.

`--no-cache` also forces Docker to re-resolve the `FROM node:24-slim` base image against the
registry instead of reusing an already-resolved local reference — a plain cached build doesn't
need to do that. This means the build step needs working network access to `docker.io` even if
`talentos-admin`/`talentos-applicant` images already exist locally; a transient DNS/registry
hiccup shows up as this step failing while everything else (Prisma generate, infra containers)
still works. If it fails here, check plain network reachability before assuming the script itself
is broken — a retry is often enough.

## If you're using `npm run dev:applicant` / `dev:admin` instead of Docker

That's a separate path (Next.js dev server directly, not containerized) with its own cache: the
`.next/` directory in each app. If a plain dev-server restart still looks stale, stop it and
delete that app's `.next/` directory before restarting — `rm -rf apps/applicant/.next` (or
`admin`). The script above targets the Docker-based stack, since that's this repo's documented
local topology (`scripts/local/bootstrap.ts`, `docs/Deployment.md`); it doesn't touch `dev:*`.

## What this does not do

It doesn't run `docker system prune` or clear Docker's global build-cache store — `--no-cache` on
`docker compose build` already ignores cached layers for this build, and reaching further into
Docker's shared cache would affect other projects on the machine too. If staleness somehow
survives even this, that's a sign to look for something other than a build/container cache (e.g.
a browser holding an old page open, or a genuinely different root cause) rather than reaching for
broader Docker cleanup.
