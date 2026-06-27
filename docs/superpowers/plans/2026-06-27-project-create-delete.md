# Project Create And Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable project creation feedback and a two-level project delete flow with sidebar right-click actions, soft delete for business owners/admins, and permanent delete for admins.

**Architecture:** Reuse the existing `projects.archived_at` field for soft deletion and existing `on delete cascade` relationships for permanent deletion. Add server-side authorization and API support first, then connect the left-sidebar context menu and confirmation UI to the real endpoint.

**Tech Stack:** Next.js App Router, React, TypeScript, Base UI/shadcn-style local components, Postgres via `pg`, Node test runner.

## Global Constraints

- Do not add a recycle bin, restore flow, extra project fields, hover `...` menu, or new project setup wizard.
- Soft delete means `projects.archived_at = now()` and `projects.status = 'archived'`; related rows and files remain.
- Permanent delete is admin-only and requires two confirmations in the UI.
- Business owners and admins can soft-delete; creative users and non-owner business users cannot.
- API authorization must enforce permissions; frontend hiding is not sufficient.
- All user-facing errors must be natural language, not raw HTTP/database/stack errors.
- No database migration is expected because `projects.archived_at` and `audit_logs.project_id on delete set null` already exist.
- Right-click on left project cards is the primary delete entry; do not add a hover menu.

---

## File Structure

- `src/server/use-cases/project-delete.ts`
  - New small use-case module for delete permission decisions and delete-mode parsing helpers.
  - Keeps branchy delete business rules out of route and repository code.
- `src/server/use-cases/project-delete.test.mjs`
  - Unit tests for permission decisions.
- `src/server/repositories/projects.ts`
  - Add repository functions for soft delete, permanent delete, and fetching deletion metadata.
- `src/app/api/projects/[projectId]/route.ts`
  - Add `DELETE` handler using the use-case and repository functions.
- `src/components/workspace/api.ts`
  - Add `deleteProject(projectId, { mode })` API wrapper and return type.
- `src/components/workspace/workspace-shell.tsx`
  - Add project context-menu state, confirmation dialogs, delete action handler, selected-project fallback, and improved create feedback.
- `src/components/workspace/workspace-shell-project-actions.test.mjs`
  - Static component tests for right-click menu and confirmation copy.

---

### Task 1: Backend Delete Rules And Repository

**Files:**
- Create: `src/server/use-cases/project-delete.ts`
- Create: `src/server/use-cases/project-delete.test.mjs`
- Modify: `src/server/repositories/projects.ts`

**Interfaces:**
- Consumes:
  - `ProjectRecord` from `src/server/repositories/projects.ts`
  - `AuthUser` from `src/server/repositories/users.ts`
- Produces:
  - `type ProjectDeleteMode = "archive" | "permanent"`
  - `assertCanDeleteProject(input: { user: AuthUser; project: ProjectRecord | null; mode: ProjectDeleteMode }): ProjectRecord`
  - `getProjectDeletionSnapshot(projectId: string): Promise<ProjectRecord | null>`
  - `archiveProject(projectId: string): Promise<ProjectRecord | null>`
  - `permanentlyDeleteProject(projectId: string): Promise<ProjectRecord | null>`

- [ ] **Step 1: Write failing permission tests**

Create `src/server/use-cases/project-delete.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

const project = {
  id: "project-1",
  brandName: "品牌",
  projectName: "项目",
  currentStage: "brand_requirement_intake",
  ownerId: "owner-1",
  ownerName: "负责人",
  dueDate: null,
  status: "in_progress",
  updatedAt: "2026-06-27T00:00:00.000Z",
};

test("assertCanDeleteProject allows owner business user to archive", async () => {
  const { assertCanDeleteProject } = await import("./project-delete.ts");
  const result = assertCanDeleteProject({
    user: { id: "owner-1", name: "商务", email: null, role: "business", isActive: true },
    project,
    mode: "archive",
  });
  assert.equal(result.id, project.id);
});

test("assertCanDeleteProject allows admin to archive and permanently delete", async () => {
  const { assertCanDeleteProject } = await import("./project-delete.ts");
  const admin = { id: "admin-1", name: "管理员", email: null, role: "admin", isActive: true };
  assert.equal(assertCanDeleteProject({ user: admin, project, mode: "archive" }).id, project.id);
  assert.equal(assertCanDeleteProject({ user: admin, project, mode: "permanent" }).id, project.id);
});

test("assertCanDeleteProject rejects creative users and non-owner business users", async () => {
  const { assertCanDeleteProject } = await import("./project-delete.ts");
  assert.throws(
    () => assertCanDeleteProject({
      user: { id: "creative-1", name: "创意", email: null, role: "creative", isActive: true },
      project,
      mode: "archive",
    }),
    (error) => error && typeof error === "object" && "code" in error && error.code === "project_delete_forbidden"
  );
  assert.throws(
    () => assertCanDeleteProject({
      user: { id: "other-business", name: "其他商务", email: null, role: "business", isActive: true },
      project,
      mode: "archive",
    }),
    (error) => error && typeof error === "object" && "code" in error && error.code === "project_delete_forbidden"
  );
});

test("assertCanDeleteProject returns natural-language not found error", async () => {
  const { assertCanDeleteProject } = await import("./project-delete.ts");
  assert.throws(
    () => assertCanDeleteProject({
      user: { id: "admin-1", name: "管理员", email: null, role: "admin", isActive: true },
      project: null,
      mode: "archive",
    }),
    (error) => error && typeof error === "object" && "code" in error && error.code === "project_not_found"
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test --import tsx src/server/use-cases/project-delete.test.mjs
```

Expected: FAIL because `src/server/use-cases/project-delete.ts` does not exist.

- [ ] **Step 3: Add delete use-case helper**

Create `src/server/use-cases/project-delete.ts`:

```ts
import { AppError } from "@/lib/errors";
import type { AuthUser } from "@/server/repositories/users";
import type { ProjectRecord } from "@/server/repositories/projects";

export type ProjectDeleteMode = "archive" | "permanent";

export function assertCanDeleteProject(input: {
  user: AuthUser;
  project: ProjectRecord | null;
  mode: ProjectDeleteMode;
}): ProjectRecord {
  if (!input.project) {
    throw new AppError({
      status: 404,
      code: "project_not_found",
      userMessage: "项目已经不存在，列表将自动刷新。",
    });
  }

  if (input.mode === "permanent") {
    if (input.user.role === "admin") return input.project;
    throw new AppError({
      status: 403,
      code: "project_delete_forbidden",
      userMessage: "只有管理员可以永久删除项目。",
    });
  }

  if (input.user.role === "admin") return input.project;
  if (input.user.role === "business" && input.project.ownerId === input.user.id) return input.project;

  throw new AppError({
    status: 403,
    code: "project_delete_forbidden",
    userMessage: "你没有删除这个项目的权限，请联系管理员处理。",
  });
}
```

- [ ] **Step 4: Run permission tests**

Run:

```bash
node --test --import tsx src/server/use-cases/project-delete.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add project repository delete functions**

Modify `src/server/repositories/projects.ts`.

Add these exports after `updateProjectBasics` and before `getProjectById`:

```ts
export async function getProjectDeletionSnapshot(projectId: string) {
  const result = await query<ProjectRow>(
    `select id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status, updated_at
     from projects
     where id = $1
     limit 1`,
    [projectId]
  );

  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function archiveProject(projectId: string) {
  const result = await query<ProjectRow>(
    `update projects
     set archived_at = now(),
         status = 'archived',
         updated_at = now()
     where id = $1
       and archived_at is null
     returning id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status, updated_at`,
    [projectId]
  );

  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function permanentlyDeleteProject(projectId: string) {
  const existing = await getProjectDeletionSnapshot(projectId);
  if (!existing) return null;

  await query(`delete from projects where id = $1`, [projectId]);
  return existing;
}
```

- [ ] **Step 6: Run focused backend checks**

Run:

```bash
node --test --import tsx src/server/use-cases/project-delete.test.mjs
npm run typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit backend helper and repository**

```bash
git add src/server/use-cases/project-delete.ts src/server/use-cases/project-delete.test.mjs src/server/repositories/projects.ts
git commit -m "feat: add project delete rules"
```

---

### Task 2: DELETE API And Client Wrapper

**Files:**
- Modify: `src/app/api/projects/[projectId]/route.ts`
- Modify: `src/components/workspace/api.ts`

**Interfaces:**
- Consumes:
  - `assertCanDeleteProject`
  - `getProjectDeletionSnapshot`
  - `archiveProject`
  - `permanentlyDeleteProject`
- Produces:
  - `deleteProject(projectId: string, input: { mode: "archive" | "permanent" }): Promise<ApiResult<{ projectId: string; mode: "archive" | "permanent"; message: string }>>`

- [ ] **Step 1: Add DELETE imports and schema**

Modify `src/app/api/projects/[projectId]/route.ts`.

Change imports to include:

```ts
import { assertCanDeleteProject, type ProjectDeleteMode } from "@/server/use-cases/project-delete";
import { createAuditLog } from "@/server/repositories/audit-logs";
import {
  archiveProject,
  getProjectDeletionSnapshot,
  permanentlyDeleteProject,
  updateProjectBasics,
} from "@/server/repositories/projects";
```

Add this schema after `updateProjectSchema`:

```ts
const deleteProjectSchema = z.object({
  mode: z.enum(["archive", "permanent"]).default("archive"),
});
```

- [ ] **Step 2: Add DELETE route**

Append this handler to `src/app/api/projects/[projectId]/route.ts`:

```ts
export async function DELETE(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;
    const body = deleteProjectSchema.parse(await request.json().catch(() => ({})));
    const mode = body.mode as ProjectDeleteMode;
    const project = await getProjectDeletionSnapshot(projectId);
    const allowedProject = assertCanDeleteProject({ user, project, mode });

    if (mode === "archive") {
      const archivedProject = await archiveProject(projectId);
      if (!archivedProject) {
        throw new AppError({
          status: 404,
          code: "project_not_found",
          userMessage: "项目已经不存在，列表将自动刷新。",
        });
      }

      await createAuditLog({
        actorId: user.id,
        projectId,
        action: "project.archived",
        objectType: "project",
        objectId: projectId,
        before: allowedProject,
        after: archivedProject,
      });

      return Response.json({
        ok: true,
        data: {
          projectId,
          mode,
          message: "项目已移出列表，资料和流程记录仍会保留。",
        },
      });
    }

    await createAuditLog({
      actorId: user.id,
      projectId,
      action: "project.deleted",
      objectType: "project",
      objectId: projectId,
      before: allowedProject,
    });
    const deletedProject = await permanentlyDeleteProject(projectId);
    if (!deletedProject) {
      throw new AppError({
        status: 404,
        code: "project_not_found",
        userMessage: "项目已经不存在，列表将自动刷新。",
      });
    }

    return Response.json({
      ok: true,
      data: {
        projectId,
        mode,
        message: "项目已永久删除。",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
```

- [ ] **Step 3: Add client API wrapper**

Modify `src/components/workspace/api.ts`.

Add after `updateProjectBasics`:

```ts
export type ProjectDeleteMode = "archive" | "permanent";

export async function deleteProject(projectId: string, input: { mode: ProjectDeleteMode }) {
  return readApi<{ projectId: string; mode: ProjectDeleteMode; message: string }>(
    await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}
```

- [ ] **Step 4: Run route and type checks**

Run:

```bash
npm run typecheck
npx eslint 'src/app/api/projects/[projectId]/route.ts' src/components/workspace/api.ts src/server/repositories/projects.ts src/server/use-cases/project-delete.ts
```

Expected: both pass.

- [ ] **Step 5: Commit API and client wrapper**

```bash
git add 'src/app/api/projects/[projectId]/route.ts' src/components/workspace/api.ts
git commit -m "feat: expose project delete api"
```

---

### Task 3: Sidebar Right-Click Menu And Confirmations

**Files:**
- Create: `src/components/workspace/workspace-shell-project-actions.test.mjs`
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes:
  - `deleteProject` and `type ProjectDeleteMode` from `src/components/workspace/api.ts`
  - `ProjectSummary`, `CurrentUser`, `ApiError`
- Produces:
  - Sidebar right-click menu and confirmation UI in `ProjectSidebar`
  - `handleDeleteProject(project: ProjectSummary, mode: ProjectDeleteMode): Promise<void>` in `WorkspaceShell`

- [ ] **Step 1: Write static UI tests**

Create `src/components/workspace/workspace-shell-project-actions.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");

test("project sidebar supports right-click project actions", () => {
  assert.match(source, /onContextMenu=/);
  assert.match(source, /project-context-menu/);
  assert.match(source, /打开项目/);
  assert.match(source, /移出项目列表/);
  assert.match(source, /永久删除/);
});

test("permanent delete uses two confirmation states", () => {
  assert.match(source, /永久删除项目/);
  assert.match(source, /再次确认永久删除/);
  assert.match(source, /确认永久删除/);
});

test("delete action calls real deleteProject api", () => {
  assert.match(source, /deleteProject\\(/);
  assert.match(source, /mode: "archive"/);
  assert.match(source, /mode: "permanent"/);
});
```

- [ ] **Step 2: Run static UI tests to verify failure**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
```

Expected: FAIL because menu code is not implemented.

- [ ] **Step 3: Import delete API and add action state**

Modify the import list from `@/components/workspace/api` in `src/components/workspace/workspace-shell.tsx` to include:

```ts
  deleteProject,
  type ProjectDeleteMode,
```

Inside `WorkspaceShell`, add state near `creating`:

```ts
  const [createProjectMessage, setCreateProjectMessage] = useState<string | null>(null);
  const [deleteProjectMessage, setDeleteProjectMessage] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
```

- [ ] **Step 4: Add delete handler**

Add inside `WorkspaceShell`, after `handleCreateProject`:

```ts
  async function handleDeleteProject(project: ProjectSummary, mode: ProjectDeleteMode) {
    setDeletingProjectId(project.id);
    setDeleteProjectMessage(null);
    setError(null);
    const result = await deleteProject(project.id, { mode });

    if (result.ok) {
      const nextProjects = projects.filter((item) => item.id !== project.id);
      setProjects(nextProjects);
      if (selectedProjectId === project.id) {
        const nextSelectedProjectId = nextProjects[0]?.id ?? null;
        setSelectedProjectId(nextSelectedProjectId);
        if (!nextSelectedProjectId) setWorkspaceData(null);
      }
      setDeleteProjectMessage(result.data.message);
      await Promise.all([refreshDashboard(), refreshGovernance()]);
    } else {
      setError(result.error);
      if (result.error.code === "project_not_found" || result.error.code === "project_access_denied") {
        await load();
      }
    }

    setDeletingProjectId(null);
  }
```

- [ ] **Step 5: Pass delete props to ProjectSidebar**

In the `ProjectSidebar` call, add:

```tsx
          onDeleteProject={(project, mode) => void handleDeleteProject(project, mode)}
          deletingProjectId={deletingProjectId}
```

Then show success feedback directly inside the right workspace section, after `RoleDashboard` and before the selected-project workspace content:

```tsx
        {deleteProjectMessage && <Feedback tone="success" text={deleteProjectMessage} />}
        {createProjectMessage && <Feedback tone="success" text={createProjectMessage} />}
```

- [ ] **Step 6: Extend ProjectSidebar props and local menu state**

Modify `ProjectSidebar` signature:

```ts
  onDeleteProject,
  deletingProjectId,
}: {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
  onCreate: (formData: FormData) => void;
  creating: boolean;
  user: CurrentUser;
  onLogout: () => void;
  onToggleSidebar: () => void;
  onDeleteProject: (project: ProjectSummary, mode: ProjectDeleteMode) => void;
  deletingProjectId: string | null;
}) {
```

Add local state after `canCreateProject`:

```ts
  const [contextMenu, setContextMenu] = useState<{ project: ProjectSummary; x: number; y: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    project: ProjectSummary;
    mode: ProjectDeleteMode;
    step: "archive" | "permanent_first" | "permanent_second";
  } | null>(null);
  const canArchiveProject = (project: ProjectSummary) => user.role === "admin" || (user.role === "business" && project.ownerName === user.name);
  const canPermanentlyDeleteProject = user.role === "admin";
```

Note: `ownerName === user.name` is only for frontend visibility. The API enforces true owner id.

- [ ] **Step 7: Add right-click handler to project buttons**

In the project list button, add:

```tsx
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ project, x: event.clientX, y: event.clientY });
                }}
```

Keep the existing `onClick={() => onSelect(project.id)}`.

- [ ] **Step 8: Add context menu JSX**

Inside `ProjectSidebar`, after the project list `ScrollArea` and before the footer, add:

```tsx
      {contextMenu && (
        <div
          className="project-context-menu fixed z-[80] min-w-44 overflow-hidden rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)] p-1 text-sm shadow-card"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            type="button"
            className="w-full rounded-[0.8rem] px-3 py-2 text-left hover:bg-[var(--surface-soft)]"
            onClick={() => {
              onSelect(contextMenu.project.id);
              setContextMenu(null);
            }}
          >
            打开项目
          </button>
          {canArchiveProject(contextMenu.project) && (
            <button
              type="button"
              className="w-full rounded-[0.8rem] px-3 py-2 text-left hover:bg-[var(--surface-soft)]"
              disabled={deletingProjectId === contextMenu.project.id}
              onClick={() => {
                setDeleteDialog({ project: contextMenu.project, mode: "archive", step: "archive" });
                setContextMenu(null);
              }}
            >
              移出项目列表
            </button>
          )}
          {canPermanentlyDeleteProject && (
            <button
              type="button"
              className="w-full rounded-[0.8rem] px-3 py-2 text-left text-[var(--danger)] hover:bg-[var(--macaron-pink-bg)]"
              disabled={deletingProjectId === contextMenu.project.id}
              onClick={() => {
                setDeleteDialog({ project: contextMenu.project, mode: "permanent", step: "permanent_first" });
                setContextMenu(null);
              }}
            >
              永久删除
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 9: Add confirmation dialog JSX**

Inside `ProjectSidebar`, after the context menu JSX, add:

```tsx
      {deleteDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/20 p-4">
          <section className="w-full max-w-md rounded-card border border-[var(--border-soft)] bg-[var(--surface-card)] p-5 shadow-card">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {deleteDialog.step === "archive"
                ? "移出项目列表？"
                : deleteDialog.step === "permanent_first"
                  ? "永久删除项目？"
                  : "再次确认永久删除"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {deleteDialog.step === "archive"
                ? `“${deleteDialog.project.projectName}”会从项目列表隐藏，但资料、流程记录和审计日志会保留。`
                : deleteDialog.step === "permanent_first"
                  ? `“${deleteDialog.project.projectName}”及关联流程记录会被删除，无法恢复。`
                  : "这个操作不可恢复。请再次确认是否永久删除该项目。"}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteDialog(null)}>
                取消
              </Button>
              {deleteDialog.step === "permanent_first" ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialog({ ...deleteDialog, step: "permanent_second" })}
                >
                  永久删除
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={deleteDialog.mode === "permanent" ? "destructive" : "default"}
                  disabled={deletingProjectId === deleteDialog.project.id}
                  onClick={() => {
                    onDeleteProject(deleteDialog.project, deleteDialog.mode);
                    setDeleteDialog(null);
                  }}
                >
                  {deletingProjectId === deleteDialog.project.id ? <Loader2 className="animate-spin" size={16} /> : null}
                  {deleteDialog.mode === "permanent" ? "确认永久删除" : "确认移出"}
                </Button>
              )}
            </div>
          </section>
        </div>
      )}
```

- [ ] **Step 10: Run UI static tests and typecheck**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
npm run typecheck
npx eslint src/components/workspace/workspace-shell.tsx
```

Expected: all pass.

- [ ] **Step 11: Commit sidebar delete UI**

```bash
git add src/components/workspace/workspace-shell.tsx src/components/workspace/workspace-shell-project-actions.test.mjs
git commit -m "feat: add project sidebar delete actions"
```

---

### Task 4: Project Creation Feedback And End-To-End Verification

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes:
  - Existing `createProject`
  - `createProjectMessage` state added in Task 3
- Produces:
  - New-project sheet closes on success.
  - Success message appears.
  - New project is selected and workspace loads.

- [ ] **Step 1: Add sheet open state for project creation**

Inside `ProjectSidebar`, add:

```ts
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
```

Change the create sheet root:

```tsx
          <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
```

- [ ] **Step 2: Close sheet after successful create**

Change `onCreate` prop type to:

```ts
  onCreate: (formData: FormData) => Promise<boolean>;
```

Change the form action:

```tsx
              <form
                action={async (formData) => {
                  const created = await onCreate(formData);
                  if (created) setCreateSheetOpen(false);
                }}
                className="grid gap-3 px-4"
              >
```

- [ ] **Step 3: Return creation success from WorkspaceShell**

Change `handleCreateProject` signature:

```ts
  async function handleCreateProject(formData: FormData): Promise<boolean> {
```

Update body:

```ts
    if (result.ok) {
      setProjects((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
      setSelectedProjectId(result.data.id);
      setCreateProjectMessage("项目已创建，可以开始录入 Brief。");
      await Promise.all([refreshWorkspace(result.data.id), refreshDashboard(), refreshGovernance()]);
      setCreating(false);
      return true;
    } else {
      setError(result.error);
      setCreating(false);
      return false;
    }
```

Remove the trailing `setCreating(false);` after the `if/else` because both branches now return.

- [ ] **Step 4: Add static create feedback assertions**

Append to `src/components/workspace/workspace-shell-project-actions.test.mjs`:

```js
test("project creation closes sheet only after successful create and shows success copy", () => {
  assert.match(source, /setCreateSheetOpen\\(false\\)/);
  assert.match(source, /项目已创建，可以开始录入 Brief。/);
  assert.match(source, /Promise<boolean>/);
});
```

- [ ] **Step 5: Run focused checks**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
npm run typecheck
npx eslint src/components/workspace/workspace-shell.tsx src/components/workspace/api.ts
```

Expected: all pass.

- [ ] **Step 6: Run full build**

Run:

```bash
npm run build
```

Expected: build passes. If `next-env.d.ts` changes from dev types to production types, restore it with:

```bash
git checkout -- next-env.d.ts
```

- [ ] **Step 7: Browser verification**

With the dev server running on `http://localhost:3001/`, verify:

1. Left sidebar project right-click opens menu.
2. `打开项目` selects that project.
3. `移出项目列表` opens the confirmation dialog.
4. Confirming soft delete removes the project from the list and selects the next project.
5. Admin sees `永久删除`.
6. `永久删除` requires two confirmations.
7. Creating a new project shows button loading, closes the sheet on success, selects the new project, and displays `项目已创建，可以开始录入 Brief。`.

- [ ] **Step 8: Commit creation feedback and verification changes**

```bash
git add src/components/workspace/workspace-shell.tsx src/components/workspace/workspace-shell-project-actions.test.mjs
git commit -m "feat: polish project creation feedback"
```

---

## Final Verification

Run the complete check set:

```bash
node --test --import tsx src/server/use-cases/project-delete.test.mjs
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
npm run typecheck
npx eslint src/components/workspace/workspace-shell.tsx src/components/workspace/api.ts 'src/app/api/projects/[projectId]/route.ts' src/server/repositories/projects.ts src/server/use-cases/project-delete.ts
npm run build
```

Then perform browser checks on `http://localhost:3001/` for create, soft delete, permanent delete, and selected-project fallback.
