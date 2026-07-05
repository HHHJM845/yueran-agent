import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");

function sliceFrom(marker, terminator) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing marker: ${marker}`);
  const end = source.indexOf(terminator, start);
  assert.notEqual(end, -1, `Missing terminator after ${marker}`);
  return source.slice(start, end);
}

test("workspace refresh only reloads current workspace data", () => {
  const refreshWorkspaceSource = sliceFrom("const refreshWorkspace = useCallback", "const refreshDashboard = useCallback");

  assert.match(refreshWorkspaceSource, /fetchWorkspace\(projectId\)/);
  assert.doesNotMatch(refreshWorkspaceSource, /fetchProjects\(/);
  assert.doesNotMatch(refreshWorkspaceSource, /refreshDashboard\(/);
  assert.doesNotMatch(refreshWorkspaceSource, /refreshGovernance\(/);
});

test("child workspace refresh does not reload dashboard or governance", () => {
  const workspaceRefreshPropSource = sliceFrom("onWorkspaceRefresh={async (stage) =>", "onDashboardRefresh=");

  assert.match(workspaceRefreshPropSource, /refreshWorkspaceStage\(selectedProject\.id, stage\)/);
  assert.match(workspaceRefreshPropSource, /refreshWorkspace\(selectedProject\.id\)/);
  assert.doesNotMatch(workspaceRefreshPropSource, /refreshDashboard\(/);
  assert.doesNotMatch(workspaceRefreshPropSource, /refreshGovernance\(/);
});

test("project stage children use selected-stage workspace patch refresh", () => {
  const workspaceCenterSource = sliceFrom("function WorkspaceCenter", "function StagePanel");

  assert.match(workspaceCenterSource, /refreshSelectedWorkspace/);
  assert.match(workspaceCenterSource, /onWorkspaceRefresh\(selectedStage\)/);
  assert.match(workspaceCenterSource, /onRefresh={refreshSelectedWorkspace}/);
});
