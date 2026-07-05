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

test("standard script validation accepts common production time aliases", async () => {
  const { validateStandardScriptFormat } = await import("./script-standardization.ts");

  const result = validateStandardScriptFormat(`《夜航冷萃》
剧情简介：凌晨加班的人在冷萃陪伴下找回清醒。
人物小传：林野，创意从业者，连续熬夜赶提案。

第一集
1-1 CBD写字楼格子间 晨 内
人物：林野
△林野敲完最后一个字，窗外晨光照进写字楼。
林野（松一口气）：终于通了。`);

  assert.equal(result.hasBlockingIssues, false);
  assert.deepEqual(
    result.issues.filter((issue) => issue.severity === "error").map((issue) => issue.code),
    []
  );
});

test("standard script validation accepts dawn headings with interior/exterior slash", async () => {
  const { validateStandardScriptFormat } = await import("./script-standardization.ts");

  const result = validateStandardScriptFormat(`《城市夜航者的同频陪伴》
剧情简介：四个城市夜归人在破晓时刻找到同频陪伴。
人物小传：阿泽，年轻商务人，习惯在城市清晨独自整理情绪。

第一集
1-5 四分格平行空间（CBD写字楼工位/老巷共享办公区/老小区出租屋/社区外街道） 破晓 内/外
人物：阿泽
△四个空间里的灯光逐渐变亮，阿泽看向窗外的第一缕天光。
阿泽：天亮之前，总会有人和我一样还醒着。`);

  assert.equal(result.hasBlockingIssues, false);
  assert.deepEqual(
    result.issues.filter((issue) => issue.severity === "error").map((issue) => issue.code),
    []
  );
});

test("standard script validation still requires a real location besides time and interior tags", async () => {
  const { validateStandardScriptFormat } = await import("./script-standardization.ts");

  const result = validateStandardScriptFormat(`《夜航冷萃》
剧情简介：凌晨加班的人在冷萃陪伴下找回清醒。
人物小传：林野，创意从业者，连续熬夜赶提案。

第一集
1-1 晨 内
人物：林野
△林野敲完最后一个字。
林野：终于通了。`);

  assert.equal(result.hasBlockingIssues, true);
  assert.ok(result.issues.some((issue) => issue.code === "missing_scene_location_time_interior"));
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
