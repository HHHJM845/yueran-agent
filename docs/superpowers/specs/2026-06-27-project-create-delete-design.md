# Project Create And Delete Design

## Context

The workspace already has a project creation entry in the left sidebar and a real `POST /api/projects` endpoint. This design keeps that creation flow and improves its feedback instead of redesigning project setup.

Project removal needs a new two-level delete flow:

- Business owner and admins can remove a project from the normal project list.
- Admins can permanently delete a project after a second confirmation.

The project rule in `docs/PRD_AND_EXECUTION_PLAN.md` says project deletion should prefer archive or soft delete over immediate physical deletion. This design follows that rule by making soft deletion the normal path and permanent deletion an admin-only path.

## Goals

- Make project creation feel complete and reliable.
- Add a left-sidebar right-click menu for project deletion.
- Support soft delete by hiding projects from the normal list while preserving all data.
- Support admin-only permanent delete for cleanup of test or temporary projects.
- Keep all destructive actions protected by server-side authorization and natural-language feedback.

## Non-Goals

- No recycle-bin or deleted-project management page in this iteration.
- No project restore flow in this iteration.
- No new project fields beyond the current brand name, project name, owner name, and due date.
- No hover `...` button in the left project list.
- No physical deletion for business users.

## User Decisions

- Delete mode: two-level delete.
- Soft delete permission: business owner and admin.
- Permanent delete permission: admin only.
- Primary UI: right-click menu on left project cards.
- Discoverability shortcut: none; no hover menu.
- Permanent delete confirmation: two-step confirmation buttons, no project-name typing.
- Create flow: keep existing sidebar entry and improve feedback.

## API Design

Add support for:

```http
DELETE /api/projects/:projectId
Content-Type: application/json

{ "mode": "archive" | "permanent" }
```

`mode: "archive"`:

- Requires admin or the business user who owns the project.
- Sets `projects.archived_at = now()`.
- Sets project `status = "archived"`.
- Leaves all related rows and files in place.
- Writes audit log action `project.archived`.
- Returns a success message suitable for UI display.

`mode: "permanent"`:

- Requires admin.
- Writes audit log action `project.deleted` before deleting the project.
- Audit log `before_json` stores at least project id, brand name, project name, owner name, current stage, status, and due date.
- Deletes the project row. Existing database cascades remove related project data; `audit_logs.project_id` is `on delete set null`, so the audit event remains.
- Returns a success message suitable for UI display.

If the project is already archived or missing:

- Archive request should return a natural-language not-found or already-removed response and the UI should refresh the list.
- Permanent delete should reject missing projects with a natural-language message.

## Authorization

Server-side authorization is mandatory.

- `archive`: allowed for admins and for business users whose `projects.owner_id` equals the current user id.
- `archive`: forbidden for creative users and non-owner business users.
- `permanent`: allowed for admins only.
- Frontend hides actions the user cannot use, but the API remains the source of truth.

## Frontend Interaction

Each left-sidebar project card supports a native right-click/context-menu interaction.

Menu items:

```text
打开项目
移出项目列表
永久删除
```

Visibility:

- `打开项目`: all users who can see the project.
- `移出项目列表`: admins and owning business users.
- `永久删除`: admins only.

Soft delete confirmation:

- Title: `移出项目列表？`
- Body: explain that the project will disappear from the list, while files, workflows, and records are retained.
- Actions: `取消`, `确认移出`.

Permanent delete confirmation:

First confirmation:

- Title: `永久删除项目？`
- Body: explain that project records and related workflow data will be deleted and cannot be recovered.
- Actions: `取消`, `永久删除`.

Second confirmation:

- Title: `再次确认永久删除`
- Body: state that the operation cannot be recovered.
- Actions: `取消`, `确认永久删除`.

After successful delete:

- Remove the project from local list state.
- If the deleted project was selected, select the next project in the list.
- If there is no next project, clear the selected project and show the existing empty state.
- Refresh dashboard and governance summaries.
- Show a natural-language success message.

## Project Creation Improvements

Keep the existing left-sidebar `新建项目` sheet and fields:

- Brand name.
- Project name.
- Owner name.
- Due date.

Improve behavior:

- Disable the submit button and show loading while the request is in flight.
- Prevent duplicate submits.
- On success, close the sheet.
- Refresh the project list.
- Select the new project.
- Load the new project workspace.
- Show success feedback: `项目已创建，可以开始录入 Brief。`
- On failure, keep the sheet open, preserve entered values, and show the API's natural-language message.

## State And Data Flow

Creation:

1. User submits current create form.
2. Frontend calls existing `createProject`.
3. API writes `projects`, `project_members`, and initial `project_stage_states`.
4. UI inserts or refreshes the project list and selects the new project.

Soft delete:

1. User right-clicks project card.
2. User chooses `移出项目列表`.
3. User confirms.
4. Frontend calls `DELETE /api/projects/:projectId` with `{ "mode": "archive" }`.
5. API checks permission, updates project archive fields, and writes audit log.
6. UI removes project from list and adjusts selection.

Permanent delete:

1. Admin right-clicks project card.
2. Admin chooses `永久删除`.
3. Admin passes both confirmations.
4. Frontend calls `DELETE /api/projects/:projectId` with `{ "mode": "permanent" }`.
5. API checks admin role, writes audit log, and deletes the project.
6. UI removes project from list and adjusts selection.

## Error Handling

All user-facing failures use natural language. The UI must not display raw HTTP errors, database errors, stack traces, or unhandled JSON.

Examples:

- `项目暂时无法移出列表，请刷新后重试。`
- `你没有删除这个项目的权限，请联系管理员处理。`
- `项目已经不存在，列表将自动刷新。`
- `项目暂时无法永久删除，请稍后重试或联系管理员。`

For delete failures, the UI should refresh the project list when the error indicates the project is already missing or inaccessible.

## Components And Files

Expected implementation surface:

- `src/server/repositories/projects.ts`
  - Add soft-delete and permanent-delete repository functions.
- `src/server/auth/rbac.ts`
  - Add delete-specific authorization helpers or reuse existing role checks plus owner checks.
- `src/app/api/projects/[projectId]/route.ts`
  - Add `DELETE` handler.
- `src/components/workspace/api.ts`
  - Add client API wrapper for project deletion.
- `src/components/workspace/workspace-shell.tsx`
  - Add sidebar context-menu state, confirmation dialogs, deletion actions, and improved create feedback.

No database migration should be required because `projects.archived_at` and `audit_logs.project_id on delete set null` already exist.

## Testing And Verification

Run:

```bash
npm run typecheck
npx eslint src/components/workspace/workspace-shell.tsx src/components/workspace/api.ts 'src/app/api/projects/[projectId]/route.ts' src/server/repositories/projects.ts src/server/auth/rbac.ts
npm run build
```

Browser checks:

- Right-clicking a project opens the context menu.
- `打开项目` selects the project.
- A business owner can soft-delete their project.
- A creative user cannot see delete actions and is rejected by API if attempted directly.
- Admin can soft-delete any project.
- Admin can permanently delete a project only after two confirmations.
- Deleting the selected project selects the next available project.
- Deleting the last project leaves the workspace in empty state.
- Creating a project shows loading, closes the sheet on success, selects the new project, and shows success feedback.

## Risks

- Permanent delete relies on database cascades. Before implementation, inspect all project-owned tables for expected `on delete cascade` behavior.
- The right-click menu has low discoverability by design. This matches the user decision, but future users may need onboarding or a secondary entry.
- Without a recycle bin, soft-deleted projects are hidden but not restorable through UI in this iteration.
