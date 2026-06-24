import test from "node:test";
import assert from "node:assert/strict";
import { buildExportFileName } from "./export-document.ts";
import { renderDocumentExport } from "../renderers/document-export.ts";

test("buildExportFileName keeps contract version and extension", () => {
  assert.equal(buildExportFileName("耐克 世界杯 AIGC 视频服务合同", 2, "pdf"), "耐克_世界杯_AIGC_视频服务合同-v2.pdf");
  assert.equal(buildExportFileName("耐克 世界杯 AIGC 视频服务合同", 2, "docx"), "耐克_世界杯_AIGC_视频服务合同-v2.docx");
});

test("renderDocumentExport creates PDF and DOCX buffers", async () => {
  const content = [
    "甲方：耐克",
    "乙方：跃然团队",
    "",
    "一、交付范围",
    "AIGC 视频创意提案、故事大纲、氛围图与视频生成交付。",
  ].join("\n");

  const pdf = await renderDocumentExport({
    title: "耐克世界杯 AIGC 视频服务合同",
    content,
    format: "pdf",
  });
  const docx = await renderDocumentExport({
    title: "耐克世界杯 AIGC 视频服务合同",
    content,
    format: "docx",
  });

  assert.equal(pdf.mimeType, "application/pdf");
  assert.equal(pdf.extension, "pdf");
  assert.ok(pdf.bytes.length > 1000);
  assert.equal(docx.mimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(docx.extension, "docx");
  assert.ok(docx.bytes.length > 1000);
});
