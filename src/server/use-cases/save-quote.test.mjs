import test from "node:test";
import assert from "node:assert/strict";

test("buildQuoteSnapshotData captures versioned quote totals and items", async () => {
  const { buildQuoteSnapshotData } = await import("./save-quote.ts");

  const snapshot = buildQuoteSnapshotData({
    quoteId: "quote-1",
    version: 2,
    title: "世界杯视频报价",
    status: "waiting_review",
    currency: "CNY",
    items: [
      { name: "创意深化", description: "故事大纲与氛围图", quantity: 1, unitPrice: 12000 },
      { name: "AIGC 视频生成", description: "主视觉视频生成", quantity: 2, unitPrice: 18000 },
    ],
    notes: "报价含两轮修改。",
  });

  assert.equal(snapshot.quoteId, "quote-1");
  assert.equal(snapshot.version, 2);
  assert.equal(snapshot.totalAmount, 48000);
  assert.equal(snapshot.currency, "CNY");
  assert.match(snapshot.summary, /创意深化/);
  assert.equal(snapshot.items.length, 2);
});
