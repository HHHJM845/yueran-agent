import assert from "node:assert/strict";
import test from "node:test";

test("standard script validation accepts the required production format", async () => {
  const { validateStandardScriptFormat } = await import("./script-standardization.ts");

  const result = validateStandardScriptFormat(`《重生之还是她》
剧情简介：一次意外重逢，让两个人重新面对彼此。
人物小传：小帅，30岁，外科医生，性格冷静、生活规律。

第一集
1-1 日 外 江边广场
人物：小帅、小美
△小帅和小美一起坐在江边广场的长椅上，小帅递给小美奶茶。
小帅（开心）：没想到在这里遇见了你。
小美（轻松）：我经常到这里，在江边吹吹风很舒服。`);

  assert.equal(result.hasBlockingIssues, false);
  assert.deepEqual(
    result.issues.filter((issue) => issue.severity === "error").map((issue) => issue.code),
    []
  );
});

test("standard script validation reports missing required script fields", async () => {
  const { validateStandardScriptFormat } = await import("./script-standardization.ts");

  const result = validateStandardScriptFormat(`第一集
1-1 江边广场
△两人坐在长椅上沉默。`);

  assert.equal(result.hasBlockingIssues, true);
  assert.deepEqual(
    result.issues.filter((issue) => issue.severity === "error").map((issue) => issue.code),
    ["missing_title", "missing_scene_location_time_interior", "missing_characters", "missing_dialogue"]
  );
});

test("standard script validation rejects unpaired flashback markers", async () => {
  const { validateStandardScriptFormat } = await import("./script-standardization.ts");

  const result = validateStandardScriptFormat(`《镜头下的危机》
第一集
1-1 日 内 医院办公室
人物：许轻言
【闪回】
△许轻言看向电脑屏幕。
许轻言（冷静）：我马上过去。`);

  assert.equal(result.hasBlockingIssues, true);
  assert.ok(result.issues.some((issue) => issue.code === "unpaired_flashback"));
});
