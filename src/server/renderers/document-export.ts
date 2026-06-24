import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun } from "docx";
import type { DocumentExportFormat } from "@/server/repositories/document-exports";

export type RenderedDocumentExport = {
  bytes: Buffer;
  mimeType: string;
  extension: DocumentExportFormat;
};

export async function renderDocumentExport(input: {
  title: string;
  content: string;
  format: DocumentExportFormat;
}): Promise<RenderedDocumentExport> {
  if (input.format === "pdf") {
    return renderPdf(input);
  }

  return renderDocx(input);
}

function renderPdf(input: { title: string; content: string }): Promise<RenderedDocumentExport> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: {
        Title: input.title,
        Creator: "AUGC Flow",
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => {
      resolve({
        bytes: Buffer.concat(chunks),
        mimeType: "application/pdf",
        extension: "pdf",
      });
    });

    const fontPath = findChineseFontPath();
    if (fontPath) {
      try {
        doc.registerFont("augc-cjk", fontPath);
        doc.font("augc-cjk");
      } catch {
        doc.font("Helvetica");
      }
    }

    doc.fontSize(18).text(input.title, { align: "center" });
    doc.moveDown(1.5);
    doc.fontSize(10).fillColor("#666666").text(`导出时间：${new Date().toLocaleString("zh-CN")}`, { align: "right" });
    doc.moveDown(1);
    doc.fillColor("#111111").fontSize(11);

    for (const line of normalizeLines(input.content)) {
      if (!line) {
        doc.moveDown(0.6);
        continue;
      }
      doc.text(line, {
        lineGap: 5,
        paragraphGap: 4,
      });
    }

    doc.end();
  });
}

async function renderDocx(input: { title: string; content: string }): Promise<RenderedDocumentExport> {
  const children = [
    new Paragraph({
      children: [new TextRun({ text: input.title, bold: true, size: 32 })],
      spacing: { after: 320 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `导出时间：${new Date().toLocaleString("zh-CN")}`, color: "666666", size: 20 })],
      spacing: { after: 280 },
    }),
    ...normalizeLines(input.content).map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line || " ", size: 22 })],
          spacing: { after: line ? 160 : 80 },
        })
    ),
  ];

  const document = new Document({
    creator: "AUGC Flow",
    title: input.title,
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return {
    bytes: await Packer.toBuffer(document),
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
  };
}

function normalizeLines(content: string) {
  return content.replace(/\r\n/g, "\n").split("\n");
}

function findChineseFontPath() {
  const candidates = [
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/NISC18030.ttf",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
