# Repository Agent Instructions

## Version Allocation

Before assigning or changing a code or documentation version:

1. Run:

   ```bash
   git fetch origin --prune
   ```

2. Read the latest allocated version from `origin/main`.

3. Inspect all active unmerged remote branches. A useful starting command is:

   ```bash
   git branch -r --no-merged origin/main
   ```

4. Exclude:
   - `origin/HEAD`
   - `origin/main`
   - branches already merged into `origin/main`
   - clearly abandoned or backup-only branches, when their status can be verified

5. Inspect versioned documentation or other authoritative version declarations on each relevant active branch.

6. Determine the highest version allocated across:
   - `origin/main`
   - all active unmerged remote branches

7. Assign the next patch version after the highest allocated version.

   Example:

   ```text
   origin/main = v0.18.3
   origin/feature-a = v0.18.4
   origin/feature-b = v0.18.5

   Next available version = v0.18.6
   ```

8. Never reuse a version that already exists on any active remote branch.

9. Immediately before the final push or merge request:
   - fetch `origin` again;
   - integrate the latest `origin/main`;
   - resolve conflicts;
   - rerun validation;
   - recheck version allocation because another branch may have allocated a version meanwhile.

10. Follow the repository's branch policy:
    - a private, unpublished feature branch may be rebased;
    - a shared or already-published branch should normally merge `origin/main` rather than rewrite history;
    - never force-push without explicit approval.

## Confirmation Gates

Before starting either of the following, stop and ask the user for explicit
confirmation. Do not proceed until the user confirms.

1. **Starting the documentation-update process** for a versioned iteration
   (creating/updating the plan, test results, and any of Data_Model,
   Data_Dictionary, Architecture, Decision_Log, Deployment,
   Regression_Scenarios, Testing_Strategy).
2. **Pushing commits to a remote branch** (including force-pushes and
   fast-forward pushes alike).
