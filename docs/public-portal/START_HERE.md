# TalentOS public graduate portal

This folder contains the product, design, API, and implementation documentation for the public portal.

Start with [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md). It explains what is currently working, how the pieces connect, how to run the portal, and what remains for later milestones.

Supporting references:

- [Design mockups](./design/DESIGN_MOCKUPS.md)
- [Backend API reference](./backend/API_ENDPOINTS.md)
- [Frontend specification](./frontend/README.md)
- [File inventory](./FILES_CREATED.md)

## Run with demonstration graduates

The standard local bootstrap now seeds four consented public graduate profiles. Each demo graduate has an accepted application, one completed and rated mission for each of weeks 1 through 4, skills, interests, and portfolio evidence.

```bash
npm run local:bootstrap
```

Open `http://localhost:3100/graduates` to view the directory. The demo seeder is idempotent, so rerunning bootstrap updates the same records instead of creating duplicates.

To seed only the Public Portal demo records after the normal database seed:

```bash
npm run seed:public-portal-demo
```

To remove only the four Public Portal demo users and their cascading records:

```bash
npm run cleanup:public-portal-demo
```

The runtime source files remain in their normal monorepo locations under `apps/` and `packages/`. Moving backend or frontend source into this documentation folder would break workspace imports, Next.js routing, Prisma generation, and Docker builds. The documentation folder is the single index that distinguishes public-portal work without duplicating executable code.
