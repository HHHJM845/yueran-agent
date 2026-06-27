# Task 2 Report: DELETE API And Client Wrapper

## Changed

- Updated `src/app/api/projects/[projectId]/route.ts` to add the DELETE handler.
- Updated `src/components/workspace/api.ts` to add the client `deleteProject` wrapper and shared `ProjectDeleteMode` type.

## What I implemented

- Added DELETE request schema handling for `mode: "archive" | "permanent"`, defaulting to archive.
- Wired the route to the existing deletion use case and repository helpers:
  - `assertCanDeleteProject`
  - `getProjectDeletionSnapshot`
  - `archiveProject`
  - `permanentlyDeleteProject`
  - `createAuditLog`
- Returned the expected success payload for both archive and permanent deletion.
- Added a client wrapper that calls `DELETE /api/projects/:projectId` and returns the typed API result.

## Validation

Executed from `/Users/zzymima0000/Documents/跃然agent/.worktrees/sop-alignment-implementation`:

```bash
npm run typecheck
npx eslint 'src/app/api/projects/[projectId]/route.ts' src/components/workspace/api.ts src/server/repositories/projects.ts src/server/use-cases/project-delete.ts
```

Validation output:

- `npm run typecheck` passed.
- ESLint passed for the targeted files.

## Notes

- I did not modify the unrelated dirty files already present in the worktree.

## Fix follow-up

Changed files:

- `src/app/api/projects/[projectId]/route.ts`
- `src/server/repositories/projects.ts`
- `src/server/repositories/audit-logs.ts`

Validation:

- `npm run typecheck` — pass
- `npx eslint 'src/app/api/projects/[projectId]/route.ts' src/components/workspace/api.ts src/server/repositories/projects.ts src/server/use-cases/project-delete.ts src/server/repositories/audit-logs.ts` — pass

## Fix follow-up

Changed files:

- `src/app/api/projects/[projectId]/route.ts`

Validation:

- `npm run typecheck` — pass
- `npx eslint 'src/app/api/projects/[projectId]/route.ts' src/components/workspace/api.ts src/server/repositories/projects.ts src/server/use-cases/project-delete.ts src/server/repositories/audit-logs.ts` — pass

## Fix follow-up

Changed files:

- `src/app/api/projects/[projectId]/route.ts`
- `src/server/repositories/projects.ts`
- `src/server/repositories/audit-logs.ts`

Validation:

- `npm run typecheck` — pass
- `npx eslint 'src/app/api/projects/[projectId]/route.ts' src/components/workspace/api.ts src/server/repositories/projects.ts src/server/use-cases/project-delete.ts src/server/repositories/audit-logs.ts` — pass
