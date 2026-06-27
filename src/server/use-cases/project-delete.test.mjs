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
    () =>
      assertCanDeleteProject({
        user: { id: "creative-1", name: "创意", email: null, role: "creative", isActive: true },
        project,
        mode: "archive",
      }),
    (error) => error && typeof error === "object" && "code" in error && error.code === "project_delete_forbidden"
  );
  assert.throws(
    () =>
      assertCanDeleteProject({
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
    () =>
      assertCanDeleteProject({
        user: { id: "admin-1", name: "管理员", email: null, role: "admin", isActive: true },
        project: null,
        mode: "archive",
      }),
    (error) => error && typeof error === "object" && "code" in error && error.code === "project_not_found"
  );
});
