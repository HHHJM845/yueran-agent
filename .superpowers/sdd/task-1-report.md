# Task 1 Report: Backend Delete Rules And Repository

## What I changed
- Added `assertCanDeleteProject` in `src/server/use-cases/project-delete.ts` with the requested `archive` and `permanent` permission rules.
- Added focused permission tests in `src/server/use-cases/project-delete.test.mjs`.
- Added repository helpers in `src/server/repositories/projects.ts`:
  - `getProjectDeletionSnapshot`
  - `archiveProject`
  - `permanentlyDeleteProject`

## Validation
- `node --test --import tsx src/server/use-cases/project-delete.test.mjs`
- `npm run typecheck`

## TDD Evidence

### RED
- Command: `node --test --import tsx src/server/use-cases/project-delete.test.mjs`
- Failing output:
  - `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/zzymima0000/Documents/跃然agent/.worktrees/sop-alignment-implementation/src/server/use-cases/project-delete.ts' imported from /Users/zzymima0000/Documents/跃然agent/.worktrees/sop-alignment-implementation/src/server/use-cases/project-delete.test.mjs`
  - All 4 tests failed because the use-case module did not exist yet.

### GREEN
- Command: `node --test --import tsx src/server/use-cases/project-delete.test.mjs`
- Passing output:
  - `✔ assertCanDeleteProject allows owner business user to archive`
  - `✔ assertCanDeleteProject allows admin to archive and permanently delete`
  - `✔ assertCanDeleteProject rejects creative users and non-owner business users`
  - `✔ assertCanDeleteProject returns natural-language not found error`
  - `ℹ tests 4`
  - `ℹ fail 0`

### Typecheck
- Command: `npm run typecheck`
- Result: passed with `tsc --noEmit` exit code 0

## Notes
- I kept the scope to backend delete helpers, the focused test, and project repository functions only.
- Existing unrelated worktree changes were left untouched.
