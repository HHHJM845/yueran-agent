import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.ALIYUN_OSS_REGION = "oss-cn-shenzhen";
process.env.ALIYUN_OSS_BUCKET = "augc-flow-test";
process.env.ALIYUN_OSS_ACCESS_KEY_ID = "test-access-key-id";
process.env.ALIYUN_OSS_ACCESS_KEY_SECRET = "test-access-key-secret";

test("createReadUrl signs response content disposition and type overrides", async () => {
  const { createReadUrl } = await import("./oss.ts");

  const url = new URL(
    createReadUrl("projects/project-1/document-exports/export-1/耐克 合同-v2.pdf", 300, {
      disposition: "attachment",
      fileName: "耐克 合同-v2.pdf",
      contentType: "application/pdf",
    })
  );

  assert.equal(url.searchParams.get("OSSAccessKeyId"), "test-access-key-id");
  assert.equal(url.searchParams.get("response-content-type"), "application/pdf");
  assert.equal(
    url.searchParams.get("response-content-disposition"),
    `attachment; filename="_ _-v2.pdf"; filename*=UTF-8''%E8%80%90%E5%85%8B%20%E5%90%88%E5%90%8C-v2.pdf`
  );

  const expires = url.searchParams.get("Expires");
  assert.ok(expires);

  const canonicalResource = [
    "/augc-flow-test/projects/project-1/document-exports/export-1/耐克 合同-v2.pdf",
    [
      [
        "response-content-disposition",
        `attachment; filename="_ _-v2.pdf"; filename*=UTF-8''%E8%80%90%E5%85%8B%20%E5%90%88%E5%90%8C-v2.pdf`,
      ],
      ["response-content-type", "application/pdf"],
    ]
      .map(([key, value]) => `${key}=${value}`)
      .join("&"),
  ].join("?");
  const expectedSignature = createHmac("sha1", "test-access-key-secret")
    .update(["GET", "", "", expires, canonicalResource].join("\n"))
    .digest("base64");

  assert.equal(url.searchParams.get("Signature"), expectedSignature);
});

test("createUploadUrl signs the content type used by browser PUT uploads", async () => {
  const { createUploadUrl } = await import("./oss.ts");

  const url = new URL(createUploadUrl("projects/project-1/assets/video-1/a-copy.mp4", { contentType: "video/mp4" }));
  const expires = url.searchParams.get("Expires");
  assert.ok(expires);

  const expectedSignature = createHmac("sha1", "test-access-key-secret")
    .update(["PUT", "", "video/mp4", expires, "/augc-flow-test/projects/project-1/assets/video-1/a-copy.mp4"].join("\n"))
    .digest("base64");

  assert.equal(url.searchParams.get("Signature"), expectedSignature);
});
