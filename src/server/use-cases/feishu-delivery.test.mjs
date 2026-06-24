import test from "node:test";
import assert from "node:assert/strict";

test("buildFeishuDeliveryMarkdown includes proposal, quote, and contract summary", async () => {
  const { buildFeishuDeliveryMarkdown } = await import("./feishu-delivery.ts");

  const markdown = buildFeishuDeliveryMarkdown({
    proposal: {
      title: "耐克世界杯创意方向提案",
      content: "提案正文：以三维写实风格呈现运动员训练与产品亮点。",
    },
    quote: {
      title: "耐克世界杯 AIGC 视频报价",
      currency: "CNY",
      totalAmount: 54000,
    },
    contract: {
      title: "耐克世界杯 AIGC 视频合同",
      content:
        "合同正文摘要：交付包括创意深化、氛围图生成和主视觉视频制作。付款按合同签署和验收节点分两期执行。",
    },
  });

  assert.match(markdown, /耐克世界杯创意方向提案/);
  assert.match(markdown, /CNY\s*54,?000/);
  assert.match(markdown, /耐克世界杯 AIGC 视频合同/);
  assert.match(markdown, /交付包括创意深化、氛围图生成和主视觉视频制作/);
});

test("sanitizeReceiverType accepts user and chat, then falls back to chat for invalid values", async () => {
  const { sanitizeReceiverType } = await import("./feishu-delivery.ts");

  assert.equal(sanitizeReceiverType("user"), "user");
  assert.equal(sanitizeReceiverType("chat"), "chat");
  assert.equal(sanitizeReceiverType("group"), "chat");
});

test("resolveFeishuRetryReceiver keeps the failed receiver when no replacement is provided", async () => {
  const { resolveFeishuRetryReceiver } = await import("./feishu-delivery.ts");

  const receiver = resolveFeishuRetryReceiver({
    currentReceiverType: "chat",
    currentReceiverId: "oc_original_chat",
    currentReceiverName: "客户群",
  });

  assert.deepEqual(receiver, {
    receiverType: "chat",
    receiverId: "oc_original_chat",
    receiverName: "客户群",
  });
});

test("resolveFeishuRetryReceiver allows changing receiver type, id, and display name", async () => {
  const { resolveFeishuRetryReceiver } = await import("./feishu-delivery.ts");

  const receiver = resolveFeishuRetryReceiver({
    currentReceiverType: "chat",
    currentReceiverId: "oc_original_chat",
    currentReceiverName: "客户群",
    requestedReceiverType: "user",
    requestedReceiverId: "ou_new_user",
    requestedReceiverName: "客户联系人",
  });

  assert.deepEqual(receiver, {
    receiverType: "user",
    receiverId: "ou_new_user",
    receiverName: "客户联系人",
  });
});

test("buildFeishuDeliveryRetryQueuedMessage tells the user when an existing Feishu document will be reused", async () => {
  const { buildFeishuDeliveryRetryQueuedMessage } = await import("./feishu-delivery.ts");

  const message = buildFeishuDeliveryRetryQueuedMessage({
    previousFailureReason: "请确认机器人已进群后重试。",
    hasReusableDocument: true,
  });

  assert.match(message, /复用上次创建成功的飞书文档/);
  assert.match(message, /请确认机器人已进群后重试/);
});
