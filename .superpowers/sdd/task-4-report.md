# Task 4 Report

## Changed files

- `src/components/workspace/workspace-shell.tsx`
- `src/components/workspace/workspace-shell-project-actions.test.mjs`
- `.superpowers/sdd/task-4-report.md`

## Behavior implemented

- Added controlled open state for the create-project sheet in `ProjectSidebar`.
- Changed the create callback contract to `onCreate: (formData: FormData) => Promise<boolean>`.
- Kept the create sheet open while the create request is in flight or fails.
- Close the create sheet only after `handleCreateProject` returns success.
- Updated project creation success copy to `项目已创建，可以开始录入 Brief。`.
- On successful create:
  - prepends the new project to the sidebar list without duplicate ids
  - selects the new project
  - refreshes workspace, dashboard, and governance data
  - loads the new project workspace so the right pane switches to the created project
- Preserved the existing Task 3 right-click delete menu behavior.

## Validation

### Command

`node --test src/components/workspace/workspace-shell-project-actions.test.mjs`

### Result

Pass

### Command

`npm run typecheck`

### Result

Pass

### Command

`npx eslint src/components/workspace/workspace-shell.tsx src/components/workspace/api.ts`

### Result

Pass

### Command

`npm run build`

### Result

Pass

Build completed successfully with a Next.js workspace-root warning about multiple `package-lock.json` files in the main repo and this worktree, but no build failure.

## Browser verification

### Status

Pass

### Target

`http://localhost:3001/`

### Verified

- Opened the existing local workspace app successfully.
- Created a real project with:
  - brand name: `Task4验收品牌`
  - project name: `Task4创建反馈验收`
  - owner: `task4-check`
- Verified the create sheet closed after successful creation.
- Verified success feedback text `项目已创建，可以开始录入 Brief。`.
- Verified the new project appeared at the top of the sidebar and was selected automatically.
- Verified the workspace loaded the new project and showed the Brief stage view.
- Re-checked Task 3 context-menu entries on a project card:
  - `打开项目`
  - `移出项目列表`
  - `永久删除`

### Not executed

- I did not confirm the destructive delete flow in-browser during Task 4 verification, to avoid mutating existing local projects beyond the required create-path validation. The right-click delete menu remained present.

## Concerns

- This worktree already contained unrelated dirty files before Task 4. I kept the patch scoped to the requested files and did not revert or rewrite unrelated changes.

## Fix follow-up

### Changed files

- `src/components/workspace/workspace-shell.tsx`
- `src/components/workspace/workspace-shell-project-actions.test.mjs`
- `.superpowers/sdd/task-4-report.md`

### Validation results

- `node --test src/components/workspace/workspace-shell-project-actions.test.mjs` — Pass
- `npm run typecheck` — Pass
- `npx eslint src/components/workspace/workspace-shell.tsx src/components/workspace/api.ts` — Pass
- `npm run build` — Pass, with the existing Next.js workspace-root warning about multiple `package-lock.json` files

### Follow-up note

- Browser verification needs to be re-run by the controller after this fix to confirm the create-project sheet now closes on successful create and still stays open on failure.
