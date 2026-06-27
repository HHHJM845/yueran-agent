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

## Notes
- I kept the scope to backend delete helpers, the focused test, and project repository functions only.
- Existing unrelated worktree changes were left untouched.
