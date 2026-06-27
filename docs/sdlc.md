# Principles of Software Development

Current code version: `v0.1.0`

Baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

0. Do what is documented. Always document what you do. Documents should be updated in docs folder in markdown format.
1. Every iteration of development must ensure that previously committed and tested work remains functional.
2. A single product architecture document covering the Product's technical design, deployment details, functionality, testing process and software design elements (preferably in UML format) is updated on each iteration.
3. Testing is done for each new iteration and a Regression test suite is updated every time the new updates are done.
4. Product runs on Docker containers so deployment is easy.
5. Deployment steps are documented in markdown and uploaded to product's technical document repo.
6. Data Model and Data Dictionary is created and updated on each iteration.
7. Product has to be Secure in design from 1st iteration - Shift left security is the fundamental principle.

## Version and Documentation Control

1. Every implementation plan must be stored as Markdown in `docs/plans/`.
2. Every version must include Markdown testing details and results in `docs/testing/`.
3. Every documentation update must reference the relevant code version.
4. Every implementation commit should mention the version when the work establishes or changes a versioned baseline.
5. Version baselines must be recorded in `docs/Version_Baseline.md`.
