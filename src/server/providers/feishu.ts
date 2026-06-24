import { env } from "@/lib/env";
import { AppError, requireConfig } from "@/lib/errors";
import type { FeishuReceiverType } from "@/server/repositories/feishu-deliveries";

const FEISHU_API_BASE_URL = "https://open.feishu.cn/open-apis";

type FeishuApiResponse = {
  code?: number;
  msg?: string;
  data?: unknown;
  tenant_access_token?: string;
};

export type FeishuDocumentResult = {
  documentToken: string;
  documentUrl: string;
};

export type FeishuMessageResult = {
  messageId: string;
};

export type FeishuReadDocumentResult = {
  token: string;
  url: string;
  text: string;
};

export async function createFeishuDocumentWithMarkdown(input: {
  title: string;
  markdown: string;
}): Promise<FeishuDocumentResult> {
  const token = await getTenantAccessToken();
  const created = await feishuRequest({
    path: "/docx/v1/documents",
    method: "POST",
    token,
    body: { title: input.title },
    userMessage: "飞书文档创建失败。请确认飞书应用已开通云文档权限，并且 App ID / Secret 配置正确。",
  });
  const documentToken = readStringPath(created.data, ["document", "document_id"]) || readStringPath(created.data, ["document_id"]);

  if (!documentToken) {
    throw new AppError({
      status: 502,
      code: "feishu_document_token_missing",
      userMessage: "飞书已经返回响应，但没有返回文档 ID。请检查飞书应用的文档创建权限。",
    });
  }

  await appendMarkdownToFeishuDocument({ token, documentToken, markdown: input.markdown });

  return {
    documentToken,
    documentUrl: buildFeishuDocumentUrl(documentToken),
  };
}

export async function sendFeishuTextMessage(input: {
  receiverType: FeishuReceiverType;
  receiverId: string;
  text: string;
}): Promise<FeishuMessageResult> {
  const token = await getTenantAccessToken();
  const receiveIdType = input.receiverType === "user" ? "open_id" : "chat_id";
  const sent = await feishuRequest({
    path: `/im/v1/messages?receive_id_type=${receiveIdType}`,
    method: "POST",
    token,
    body: {
      receive_id: input.receiverId,
      msg_type: "text",
      content: JSON.stringify({ text: input.text }),
    },
    userMessage:
      input.receiverType === "user"
        ? "飞书个人消息发送失败。请确认接收人的 open_id 正确，并且飞书应用拥有发送消息权限。"
        : "飞书群消息发送失败。请确认群聊 chat_id 正确，机器人已进群，并且飞书应用拥有发送消息权限。",
  });
  const messageId = readStringPath(sent.data, ["message_id"]) || readStringPath(sent.data, ["message", "message_id"]);

  if (!messageId) {
    throw new AppError({
      status: 502,
      code: "feishu_message_id_missing",
      userMessage: "飞书已经返回响应，但没有返回消息 ID。请在飞书后台确认消息发送权限和接收对象。",
    });
  }

  return { messageId };
}

export async function readFeishuDocumentPlainText(input: { url: string }): Promise<FeishuReadDocumentResult> {
  const parsed = parseFeishuDocumentUrl(input.url);
  const token = await getTenantAccessToken();
  const documentToken =
    parsed.kind === "wiki"
      ? await resolveWikiDocumentToken({ token, wikiToken: parsed.token })
      : parsed.token;
  const blocks = await listFeishuDocumentBlocks({ token, documentToken });
  const text = blocks.map(extractTextFromBlock).filter(Boolean).join("\n\n").trim();

  if (!text) {
    throw new AppError({
      status: 422,
      code: "feishu_document_empty",
      userMessage: "飞书文档可以访问，但没有读取到可分析正文。请确认文档里有文字内容，或检查应用是否有读取文档块权限。",
    });
  }

  return {
    token: documentToken,
    url: input.url,
    text,
  };
}

async function appendMarkdownToFeishuDocument(input: {
  token: string;
  documentToken: string;
  markdown: string;
}) {
  const chunks = splitTextForFeishu(input.markdown);
  if (chunks.length === 0) return;

  await feishuRequest({
    path: `/docx/v1/documents/${encodeURIComponent(input.documentToken)}/blocks/${encodeURIComponent(input.documentToken)}/children`,
    method: "POST",
    token: input.token,
    body: {
      children: chunks.map((content) => ({
        block_type: 2,
        text: {
          elements: [
            {
              text_run: {
                content,
              },
            },
          ],
          style: {},
        },
      })),
    },
    userMessage: "飞书文档内容写入失败。文档可能已创建，但正文没有写入，请确认应用拥有编辑文档块权限后重试。",
  });
}

function parseFeishuDocumentUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError({
      status: 400,
      code: "invalid_feishu_url",
      userMessage: "飞书链接格式不正确。请粘贴完整的飞书文档链接后再解析。",
    });
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const docxIndex = segments.findIndex((segment) => segment === "docx");
  if (docxIndex >= 0 && segments[docxIndex + 1]) {
    return { kind: "docx" as const, token: segments[docxIndex + 1] };
  }

  const docsIndex = segments.findIndex((segment) => segment === "docs" || segment === "doc");
  if (docsIndex >= 0 && segments[docsIndex + 1]) {
    return { kind: "docx" as const, token: segments[docsIndex + 1] };
  }

  const wikiIndex = segments.findIndex((segment) => segment === "wiki");
  if (wikiIndex >= 0 && segments[wikiIndex + 1]) {
    return { kind: "wiki" as const, token: segments[wikiIndex + 1] };
  }

  throw new AppError({
    status: 422,
    code: "unsupported_feishu_url",
    userMessage: "当前只支持飞书 Docx、Docs 或 Wiki 文档链接。请确认链接类型后重试。",
  });
}

async function resolveWikiDocumentToken(input: { token: string; wikiToken: string }) {
  const response = await feishuRequest({
    path: `/wiki/v2/spaces/get_node?token=${encodeURIComponent(input.wikiToken)}`,
    method: "GET",
    token: input.token,
    userMessage: "飞书 Wiki 节点解析失败。请确认应用拥有 Wiki 读取权限，并且链接对应用可见。",
  });
  const objectToken =
    readStringPath(response.data, ["node", "obj_token"]) ||
    readStringPath(response.data, ["node", "object_token"]) ||
    readStringPath(response.data, ["obj_token"]);

  if (!objectToken) {
    throw new AppError({
      status: 502,
      code: "feishu_wiki_token_missing",
      userMessage: "飞书 Wiki 已返回响应，但没有返回可读取的文档 token。请确认该 Wiki 节点是文档类型。",
    });
  }

  return objectToken;
}

async function listFeishuDocumentBlocks(input: { token: string; documentToken: string }) {
  const blocks: unknown[] = [];
  let pageToken = "";

  do {
    const query = new URLSearchParams({ page_size: "500" });
    if (pageToken) query.set("page_token", pageToken);
    const response = await feishuRequest({
      path: `/docx/v1/documents/${encodeURIComponent(input.documentToken)}/blocks?${query.toString()}`,
      method: "GET",
      token: input.token,
      userMessage: "飞书文档正文读取失败。请确认应用拥有读取文档块权限，并且文档已授权给该应用。",
    });
    const items = readArrayPath(response.data, ["items"]) || readArrayPath(response.data, ["blocks"]);
    blocks.push(...items);
    pageToken = readStringPath(response.data, ["page_token"]) || readStringPath(response.data, ["next_page_token"]);
    const hasMore = readBooleanPath(response.data, ["has_more"]);
    if (!hasMore) pageToken = "";
  } while (pageToken);

  return blocks;
}

async function getTenantAccessToken() {
  const appId = requireConfig(env.FEISHU_APP_ID, "飞书 App ID");
  const appSecret = requireConfig(env.FEISHU_APP_SECRET, "飞书 App Secret");
  const response = await fetch(`${FEISHU_API_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });
  const payload = (await safeJson(response)) as FeishuApiResponse;

  if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) {
    throw new AppError({
      status: response.ok ? 502 : response.status,
      code: "feishu_token_failed",
      userMessage: "飞书授权失败。请确认 App ID、App Secret、应用状态和租户权限都已配置正确。",
    });
  }

  return payload.tenant_access_token;
}

async function feishuRequest(input: {
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  token: string;
  body?: Record<string, unknown>;
  userMessage: string;
}) {
  const response = await fetch(`${FEISHU_API_BASE_URL}${input.path}`, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const payload = (await safeJson(response)) as FeishuApiResponse;

  if (!response.ok || payload.code !== 0) {
    throw new AppError({
      status: response.ok ? 502 : response.status,
      code: "feishu_api_failed",
      userMessage: input.userMessage,
    });
  }

  return payload;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function readStringPath(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return "";
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : "";
}

function readBooleanPath(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return false;
    current = (current as Record<string, unknown>)[key];
  }

  return current === true;
}

function readArrayPath(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return [];
    current = (current as Record<string, unknown>)[key];
  }

  return Array.isArray(current) ? current : [];
}

function extractTextFromBlock(block: unknown) {
  const parts: string[] = [];
  collectTextRuns(block, parts);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function collectTextRuns(value: unknown, parts: string[]) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectTextRuns(item, parts);
    return;
  }

  const record = value as Record<string, unknown>;
  const textRun = record.text_run;
  if (textRun && typeof textRun === "object" && !Array.isArray(textRun)) {
    const content = (textRun as Record<string, unknown>).content;
    if (typeof content === "string") {
      parts.push(content);
    }
  }

  for (const [key, item] of Object.entries(record)) {
    if (key === "content" && typeof item === "string" && record.text_run) continue;
    collectTextRuns(item, parts);
  }
}

function splitTextForFeishu(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  return paragraphs.flatMap((paragraph) => {
    if (paragraph.length <= 1800) return [paragraph];
    const chunks: string[] = [];
    for (let index = 0; index < paragraph.length; index += 1800) {
      chunks.push(paragraph.slice(index, index + 1800));
    }
    return chunks;
  });
}

function buildFeishuDocumentUrl(documentToken: string) {
  return `https://www.feishu.cn/docx/${encodeURIComponent(documentToken)}`;
}
