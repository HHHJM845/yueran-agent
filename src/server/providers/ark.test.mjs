import assert from "node:assert/strict";
import test from "node:test";

test("parseJsonContent accepts strict JSON", async () => {
  const { parseJsonContent } = await import("./ark.ts");

  assert.deepEqual(parseJsonContent('{"ok":true,"items":[1,2]}'), {
    ok: true,
    items: [1, 2],
  });
});

test("parseJsonContent extracts JSON fenced in markdown", async () => {
  const { parseJsonContent } = await import("./ark.ts");

  assert.deepEqual(
    parseJsonContent(`
\`\`\`json
{"expansions":[{"title":"场景一","oneLiner":"开场"}]}
\`\`\`
`),
    {
      expansions: [{ title: "场景一", oneLiner: "开场" }],
    }
  );
});

test("parseJsonContent extracts the first balanced JSON object from prose", async () => {
  const { parseJsonContent } = await import("./ark.ts");

  const parsed = parseJsonContent(`
好的，以下为拆分结果：
{"expansions":[{"title":"场景一","oneLiner":"城市夜航","storyArc":{"beginning":"开场"},"visualHighlights":["霓虹"],"visualStyle":"写实","productionDifficulty":"","riskNotes":""}]}
请查收。
`);

  assert.equal(parsed.expansions[0].title, "场景一");
  assert.equal(parsed.expansions[0].visualHighlights[0], "霓虹");
});

test("parseJsonContent ignores brackets in prose before the JSON payload", async () => {
  const { parseJsonContent } = await import("./ark.ts");

  const parsed = parseJsonContent('提示：[仅供参考] 实际 JSON：{"title":"完整故事","script":"人物说：\\"出发\\"。"}');

  assert.equal(parsed.title, "完整故事");
  assert.equal(parsed.script, '人物说："出发"。');
});
