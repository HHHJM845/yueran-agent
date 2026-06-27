# Final Review Fix Report

Date: 2026-06-27

## Scope

- Fixed project archive visibility to use stable owner identity instead of owner display name.
- Exposed `ownerId` on `ProjectSummary` so the client list can make the same authorization decision as the backend.
- Kept admin permanent delete behavior unchanged.

## Changes

- `src/domain/types.ts`
  - Added `ownerId: string | null` to `ProjectSummary`.
- `src/components/workspace/workspace-shell.tsx`
  - Changed `canArchiveProject` to allow admin users or business users whose `project.ownerId === user.id`.
- `src/components/workspace/workspace-shell-project-actions.test.mjs`
  - Updated regression coverage to assert the stable owner-id check and reject the old owner-name comparison.
- `src/server/repositories/projects.ts`
  - Simplified `ProjectRecord` to `ProjectSummary` now that the summary shape already includes `ownerId`.

## Verification

- `node --test src/components/workspace/workspace-shell-project-actions.test.mjs`
  - PASS.
- `npm run typecheck`
  - PASS.
- `npx eslint src/components/workspace/workspace-shell.tsx src/components/workspace/api.ts 'src/app/api/projects/[projectId]/route.ts' src/server/repositories/projects.ts src/server/use-cases/project-delete.ts src/server/repositories/audit-logs.ts`
  - PASS.

## Concerns

- No live browser or provider smoke test was requested for this final review blocker.
