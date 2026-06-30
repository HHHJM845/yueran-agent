import { createHash, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const UI_INSPECTION_MARKER = "ui_inspection_sample";
const BRAND_NAME = "流程巡检";
const PROJECT_NAME_PREFIX = "全流程界面卡片检查";
const OWNER_NAME = "UI 巡检";
const SAMPLE_IMAGE_URL =
  "https://augc-flow.oss-cn-shenzhen.aliyuncs.com/projects/de34f8aa-8c85-4005-8c60-bca30579f128/generated-images/a61cf4f6-01e1-43d8-b27e-3df668186a1c/atmosphere.png";
const SAMPLE_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const stageKeys = [
  "brand_requirement_intake",
  "technical_feasibility",
  "creative_direction_proposal",
  "selection_quote_contract",
  "script_storyboard_confirmation",
  "storyboard_image_canvas",
  "ai_video_canvas",
  "a_copy_revision",
  "b_copy_final_confirmation",
  "settlement_delivery_archive",
] as const;

type StageKey = (typeof stageKeys)[number];
type Db = Awaited<ReturnType<typeof getDb>>;
type QueryRunner = Db["query"];
type TransactionRunner = Parameters<Db["withTransaction"]>[0] extends (query: infer T) => Promise<unknown> ? T : never;

const PROJECT_NAME = `${PROJECT_NAME_PREFIX} UI 巡检样例`;
const SAMPLE_PROVIDER = "ui_inspection";
const SAMPLE_MODEL = "ui_inspection_sample";
const SAMPLE_EXTERNAL_URL = "https://example.com/ui-inspection/brief";
const SAMPLE_FACTS = [
  {
    fieldKey: "role_count",
    fieldLabel: "角色数量",
    value: { count: 2, label: "双主角产品演绎" },
    evidence: "UI 巡检样例 Brief 指定 2 位核心角色共同出镜。",
    confidence: 0.92,
  },
  {
    fieldKey: "scene_count",
    fieldLabel: "场景数量",
    value: { count: 6, label: "办公室与门店切换" },
    evidence: "需求写明共 6 个场景，需要室内外来回切换。",
    confidence: 0.88,
  },
  {
    fieldKey: "duration_seconds",
    fieldLabel: "视频时长",
    value: { seconds: 45, label: "45 秒品牌短片" },
    evidence: "客户要求控制在 45 秒内，适配信息流投放。",
    confidence: 0.95,
  },
  {
    fieldKey: "delivery_cycle",
    fieldLabel: "交付周期",
    value: { days: 7, label: "7 天交付首版" },
    evidence: "客户希望 7 天内完成首版并进入修改。",
    confidence: 0.91,
  },
  {
    fieldKey: "payment_terms",
    fieldLabel: "付款条件",
    value: { deposit: "50%", balance: "验收后 5 天内" },
    evidence: "付款方式为 50% 预付款，余款在验收后 5 天内支付。",
    confidence: 0.86,
  },
] as const;
const SAMPLE_DIMENSIONS = [
  {
    dimensionKey: "requirement_completeness",
    level: "low",
    evidence: "核心卖点、禁忌项和交付规格都在 Brief 中明确列出。",
    anchorText: "需求字段完整，可直接转结构化需求。",
    confidence: 0.93,
  },
  {
    dimensionKey: "material_availability",
    level: "medium",
    evidence: "已有品牌手册，但门店实拍参考不足，需要补更多空间素材。",
    anchorText: "视觉参考存在空缺，需补充店内机位照片。",
    confidence: 0.84,
  },
  {
    dimensionKey: "creative_expression_risk",
    level: "high",
    evidence: "客户同时要求真实感和轻拟人演绎，风格边界较窄。",
    anchorText: "写实质感与戏剧表达需要精细平衡。",
    confidence: 0.89,
  },
  {
    dimensionKey: "production_complexity",
    level: "high",
    evidence: "涉及双角色、多场景、镜头切换和 7 天压缩排期。",
    anchorText: "制作链路密集，需要前置锁定镜头方案。",
    confidence: 0.9,
  },
  {
    dimensionKey: "compliance_delivery",
    level: "medium",
    evidence: "交付周期紧，但内容方向合规风险可控。",
    anchorText: "排期风险高于合规风险，需保留缓冲。",
    confidence: 0.81,
  },
] as const;

function asJson(value: unknown) {
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function getDb() {
  const { query, withTransaction } = await import("@/lib/db");
  return { query, withTransaction };
}

async function ensureSeedActor(runQuery?: QueryRunner) {
  const query = runQuery ?? (await getDb()).query;
  const email = "ui-inspection@local.invalid";
  const existing = await query<{ id: string }>(`select id from users where email = $1 limit 1`, [email]);
  if (existing.rows[0]) return existing.rows[0].id;

  const id = randomUUID();
  await query(
    `insert into users (id, name, email, role, is_active)
     values ($1, 'UI 巡检 Agent', $2, 'admin', true)`,
    [id, email]
  );
  return id;
}

async function ensureUiInspectionProject(actorId: string, runQuery?: QueryRunner) {
  const query = runQuery ?? (await getDb()).query;
  const existing = await query<{ id: string }>(
    `select id
     from projects
     where archived_at is null
       and brand_name = $1
       and project_name = $2
     order by updated_at desc
     limit 1`,
    [BRAND_NAME, PROJECT_NAME]
  );
  const projectId = existing.rows[0]?.id ?? randomUUID();

  if (!existing.rows[0]) {
    await query(
      `insert into projects (id, brand_name, project_name, current_stage, owner_id, owner_name, due_date, status)
       values ($1, $2, $3, 'settlement_delivery_archive', $4, $5, current_date + interval '14 days', 'in_progress')`,
      [projectId, BRAND_NAME, PROJECT_NAME, actorId, OWNER_NAME]
    );
  } else {
    await query(
      `update projects
       set current_stage = 'settlement_delivery_archive',
           status = 'in_progress',
           owner_id = coalesce(owner_id, $2),
           owner_name = $3,
           updated_at = now()
       where id = $1`,
      [projectId, actorId, OWNER_NAME]
    );
  }

  await query(
    `insert into project_members (project_id, user_id, role)
     values ($1, $2, 'admin')
     on conflict (project_id, user_id) do update set role = excluded.role`,
    [projectId, actorId]
  );
  return projectId;
}

async function seedStageStates(projectId: string, runQuery?: QueryRunner) {
  const query = runQuery ?? (await getDb()).query;
  for (const stageKey of stageKeys) {
    const status = stageKey === "settlement_delivery_archive" ? "in_progress" : "completed";
    await query(
      `insert into project_stage_states (
         project_id, stage_key, status, owner_name, started_at, completed_at,
         input_refs, output_refs, snapshot, updated_at
       )
       values ($1, $2, $3, $4, now(), case when $3 = 'completed' then now() else null end,
               '[]'::jsonb, '[]'::jsonb, $5::jsonb, now())
       on conflict (project_id, stage_key)
       do update set
         status = excluded.status,
         owner_name = excluded.owner_name,
         started_at = coalesce(project_stage_states.started_at, excluded.started_at),
         completed_at = excluded.completed_at,
         snapshot = excluded.snapshot,
         updated_at = now()`,
      [projectId, stageKey, status, OWNER_NAME, JSON.stringify({ marker: UI_INSPECTION_MARKER, stageKey })]
    );
  }
}

async function findExistingId(
  query: QueryRunner | TransactionRunner,
  sql: string,
  params: readonly unknown[]
) {
  const result = await query<{ id: string }>(sql, [...params]);
  return result.rows[0]?.id ?? null;
}

async function upsertAsset(query: TransactionRunner, input: {
  projectId: string;
  actorId: string;
  fileName: string;
  assetType: string;
  sourceType: string;
  parseStatus: string;
  externalUrl?: string | null;
  externalProvider?: string | null;
  mimeType?: string | null;
}) {
  const existingId = await findExistingId(
    query,
    `select id
     from assets
     where project_id = $1
       and file_name = $2
     limit 1`,
    [input.projectId, input.fileName]
  );

  if (existingId) {
    await query(
      `update assets
       set uploaded_by = $2,
           asset_type = $3,
           source_type = $4,
           parse_status = $5,
           external_url = $6,
           external_provider = $7,
           mime_type = $8,
           updated_at = now()
       where id = $1`,
      [
        existingId,
        input.actorId,
        input.assetType,
        input.sourceType,
        input.parseStatus,
        input.externalUrl ?? null,
        input.externalProvider ?? null,
        input.mimeType ?? null,
      ]
    );
    return existingId;
  }

  const result = await query<{ id: string }>(
    `insert into assets (
       project_id, uploaded_by, asset_type, source_type, external_url, external_provider,
       file_name, mime_type, parse_status
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [
      input.projectId,
      input.actorId,
      input.assetType,
      input.sourceType,
      input.externalUrl ?? null,
      input.externalProvider ?? null,
      input.fileName,
      input.mimeType ?? null,
      input.parseStatus,
    ]
  );

  return result.rows[0].id;
}

async function upsertArtifact(query: TransactionRunner, input: {
  projectId: string;
  actorId: string;
  kind: string;
  title: string;
  status: string;
  data: unknown;
}) {
  const existingId = await findExistingId(
    query,
    `select id
     from artifacts
     where project_id = $1
       and kind = $2
       and title = $3
     limit 1`,
    [input.projectId, input.kind, input.title]
  );

  if (existingId) {
    await query(
      `update artifacts
       set status = $2,
           data_json = $3::jsonb,
           created_by = $4,
           updated_at = now()
       where id = $1`,
      [existingId, input.status, asJson(input.data), input.actorId]
    );
    return existingId;
  }

  const result = await query<{ id: string }>(
    `insert into artifacts (project_id, kind, title, status, data_json, created_by)
     values ($1, $2, $3, $4, $5::jsonb, $6)
     returning id`,
    [input.projectId, input.kind, input.title, input.status, asJson(input.data), input.actorId]
  );
  return result.rows[0].id;
}

async function upsertGeneratedImage(query: TransactionRunner, input: {
  projectId: string;
  actorId: string;
  prompt: string;
  directionId?: string | null;
  expansionId?: string | null;
  ossUrl: string;
  reviewStatus?: string;
  metadata: Record<string, unknown>;
}) {
  const existingId = await findExistingId(
    query,
    `select id
     from generated_images
     where project_id = $1
       and provider = $2
       and prompt = $3
     limit 1`,
    [input.projectId, SAMPLE_PROVIDER, input.prompt]
  );

  if (existingId) {
    await query(
      `update generated_images
       set direction_id = $2,
           expansion_id = $3,
           model_name = $4,
           status = 'succeeded',
           oss_url = $5,
           metadata_json = $6::jsonb,
           review_status = $7,
           reviewed_by = $8,
           reviewed_at = now(),
           failure_reason = null,
           updated_at = now()
       where id = $1`,
      [
        existingId,
        input.directionId ?? null,
        input.expansionId ?? null,
        SAMPLE_MODEL,
        input.ossUrl,
        asJson(input.metadata),
        input.reviewStatus ?? "confirmed",
        input.actorId,
      ]
    );
    return existingId;
  }

  const result = await query<{ id: string }>(
    `insert into generated_images (
       project_id, direction_id, expansion_id, prompt, provider, model_name, status,
       oss_url, metadata_json, review_status, reviewed_by, reviewed_at, created_by
     )
     values (
       $1, $2, $3, $4, $5, $6, 'succeeded',
       $7, $8::jsonb, $9, $10, now(), $10
     )
     returning id`,
    [
      input.projectId,
      input.directionId ?? null,
      input.expansionId ?? null,
      input.prompt,
      SAMPLE_PROVIDER,
      SAMPLE_MODEL,
      input.ossUrl,
      asJson(input.metadata),
      input.reviewStatus ?? "confirmed",
      input.actorId,
    ]
  );
  return result.rows[0].id;
}

async function upsertDocumentSnapshot(query: TransactionRunner, input: {
  projectId: string;
  actorId: string;
  documentType: string;
  documentId: string;
  title: string;
  version: number;
  status: string;
  content: string;
  summary: string;
  snapshot: unknown;
}) {
  const existingId = await findExistingId(
    query,
    `select id
     from document_snapshots
     where project_id = $1
       and document_type = $2
       and document_id = $3
       and title = $4
     limit 1`,
    [input.projectId, input.documentType, input.documentId, input.title]
  );

  if (existingId) {
    await query(
      `update document_snapshots
       set version = $2,
           status = $3,
           content = $4,
           summary = $5,
           snapshot_json = $6::jsonb,
           created_by = $7
       where id = $1`,
      [existingId, input.version, input.status, input.content, input.summary, asJson(input.snapshot), input.actorId]
    );
    return existingId;
  }

  const result = await query<{ id: string }>(
    `insert into document_snapshots (
       project_id, document_type, document_id, title, version, status, content, summary, snapshot_json, created_by
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     returning id`,
    [
      input.projectId,
      input.documentType,
      input.documentId,
      input.title,
      input.version,
      input.status,
      input.content,
      input.summary,
      asJson(input.snapshot),
      input.actorId,
    ]
  );
  return result.rows[0].id;
}

async function seedBriefAndRisk(projectId: string, actorId: string): Promise<void> {
  const { withTransaction } = await getDb();
  await withTransaction(async (query) => {
    const briefAssetId = await upsertAsset(query, {
      projectId,
      actorId,
      fileName: "UI 巡检样例 Brief.txt",
      assetType: "text",
      sourceType: "external",
      parseStatus: "succeeded",
      externalUrl: SAMPLE_EXTERNAL_URL,
      externalProvider: SAMPLE_PROVIDER,
      mimeType: "text/plain",
    });

    const artifactId = await upsertArtifact(query, {
      projectId,
      actorId,
      kind: "structured_requirement",
      title: "UI 巡检样例：标准化 Brief",
      status: "confirmed",
      data: {
        marker: UI_INSPECTION_MARKER,
        assetId: briefAssetId,
        brand: BRAND_NAME,
        objective: "用 SOP 1-5 卡片验证工作台在真实表结构上的取数完整性。",
        audience: "到店决策用户",
        style: "真实感产品叙事",
        budget: "8-12 万",
      },
    });

    const cardResult = await query<{ id: string }>(
      `insert into risk_check_cards (
         project_id, status, overall_alert, redline_alerts, human_decision, decision_reason,
         decided_by, decided_at, source_artifact_id, created_by
       )
       values (
         $1, 'approved', 'high', $2::jsonb, 'conditional_accept',
         'UI 巡检样例：允许推进，但必须先锁定角色与场景素材边界。',
         $3, now(), $4, $3
       )
       on conflict (project_id)
       do update set
         status = excluded.status,
         overall_alert = excluded.overall_alert,
         redline_alerts = excluded.redline_alerts,
         human_decision = excluded.human_decision,
         decision_reason = excluded.decision_reason,
         decided_by = excluded.decided_by,
         decided_at = excluded.decided_at,
         source_artifact_id = excluded.source_artifact_id,
         updated_at = now()
       returning id`,
      [
        projectId,
        asJson(["7 天交付窗口过紧，需要先确认镜头数量与门店拍摄素材。", "角色与场景切换频繁，建议先锁定一版文字分镜。"]),
        actorId,
        artifactId,
      ]
    );

    const cardId = cardResult.rows[0].id;

    await query(`delete from risk_check_facts where project_id = $1 and card_id = $2`, [projectId, cardId]);
    await query(`delete from risk_check_dimensions where project_id = $1 and card_id = $2`, [projectId, cardId]);

    for (const fact of SAMPLE_FACTS) {
      await query(
        `insert into risk_check_facts (
           project_id, card_id, field_key, field_label, value_json, evidence, confidence, created_by
         )
         values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
        [projectId, cardId, fact.fieldKey, fact.fieldLabel, asJson(fact.value), fact.evidence, fact.confidence, actorId]
      );
    }

    for (const dimension of SAMPLE_DIMENSIONS) {
      await query(
        `insert into risk_check_dimensions (
           project_id, card_id, dimension_key, level, evidence, anchor_text, confidence, created_by
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          projectId,
          cardId,
          dimension.dimensionKey,
          dimension.level,
          dimension.evidence,
          dimension.anchorText,
          dimension.confidence,
          actorId,
        ]
      );
    }
  });
}

async function seedCreativeAndCommercial(projectId: string, actorId: string): Promise<{
  directionId: string;
  roundId: string;
  quoteId: string;
  contractId: string;
}> {
  const { withTransaction } = await getDb();
  return withTransaction(async (query) => {
    const directionTitles = [
      "UI 巡检样例方向 1｜门店焕新体验",
      "UI 巡检样例方向 2｜双主角真实叙事",
      "UI 巡检样例方向 3｜高效服务切片",
      "UI 巡检样例方向 4｜品牌信任证明",
    ];

    const directionIds: string[] = [];
    for (const [index, title] of directionTitles.entries()) {
      const selected = index === 1;
      const existingId = await findExistingId(
        query,
        `select id
         from creative_directions
         where project_id = $1
           and title = $2
         limit 1`,
        [projectId, title]
      );

      if (existingId) {
        await query(
          `update creative_directions
           set core_idea = $2,
               fit_reason = $3,
               risk_notes = $4,
               reference_tags = $5::jsonb,
               score = $6,
               cost_estimate = $7,
               cycle_estimate = $8,
               technical_difficulty = $9,
               atmosphere_prompt = $10,
               detail_json = $11::jsonb,
               is_selected = $12,
               selected_at = case when $12 then now() else null end,
               status = 'approved',
               sort_order = $13,
               created_by = $14,
               updated_at = now()
           where id = $1`,
          [
            existingId,
            `UI 巡检样例核心概念 ${index + 1}`,
            "对应客户需要的真实质感、服务感与品牌可信度。",
            "需要在真实感和画面张力之间控制力度。",
            asJson(["UI 巡检样例", "SOP3", selected ? "selected" : "candidate"]),
            86 + index,
            "8-12 万",
            "7-10 天",
            index >= 2 ? "medium" : "high",
            `UI 巡检样例方向 ${index + 1} 氛围图 prompt`,
            asJson({ marker: UI_INSPECTION_MARKER, phase: "creative_direction", index: index + 1 }),
            selected,
            index + 1,
            actorId,
          ]
        );
        directionIds.push(existingId);
      } else {
        const inserted = await query<{ id: string }>(
          `insert into creative_directions (
             project_id, title, core_idea, fit_reason, risk_notes, reference_tags, score,
             cost_estimate, cycle_estimate, technical_difficulty, atmosphere_prompt,
             detail_json, is_selected, selected_at, status, sort_order, created_by
           )
           values (
             $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11,
             $12::jsonb, $13, case when $13 then now() else null end, 'approved', $14, $15
           )
           returning id`,
          [
            projectId,
            title,
            `UI 巡检样例核心概念 ${index + 1}`,
            "对应客户需要的真实质感、服务感与品牌可信度。",
            "需要在真实感和画面张力之间控制力度。",
            asJson(["UI 巡检样例", "SOP3", selected ? "selected" : "candidate"]),
            86 + index,
            "8-12 万",
            "7-10 天",
            index >= 2 ? "medium" : "high",
            `UI 巡检样例方向 ${index + 1} 氛围图 prompt`,
            asJson({ marker: UI_INSPECTION_MARKER, phase: "creative_direction", index: index + 1 }),
            selected,
            index + 1,
            actorId,
          ]
        );
        directionIds.push(inserted.rows[0].id);
      }
    }

    const directionId = directionIds[1];

    const expansionTitle = "UI 巡检样例方向 2｜扩写提案";
    const expansionId =
      (await findExistingId(
        query,
        `select id
         from creative_expansions
         where project_id = $1
           and direction_id = $2
           and title = $3
         limit 1`,
        [projectId, directionId, expansionTitle]
      )) ?? randomUUID();

    if ((await findExistingId(query, `select id from creative_expansions where id = $1`, [expansionId])) !== null) {
      await query(
        `update creative_expansions
         set one_liner = $2,
             story_arc_json = $3::jsonb,
             visual_highlights = $4::jsonb,
             visual_style = $5,
             production_difficulty = $6,
             risk_notes = $7,
             status = 'approved',
             sort_order = 1,
             created_by = $8,
             updated_at = now()
         where id = $1`,
        [
          expansionId,
          "双主角在真实门店场景中完成一段可感知的服务旅程。",
          asJson({
            opening: "客户抵达门店产生疑问。",
            middle: "双主角用产品体验化解顾虑。",
            ending: "品牌价值在真实使用中落地。",
          }),
          asJson(["环境光变化", "服务动作细节", "门店真实陈列"]),
          "写实电影感",
          "medium",
          "需要控制演员关系和真实场景调度。",
          actorId,
        ]
      );
    } else {
      await query(
        `insert into creative_expansions (
           id, project_id, direction_id, title, one_liner, story_arc_json, visual_highlights,
           visual_style, production_difficulty, risk_notes, status, sort_order, created_by
         )
         values (
           $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, 'approved', 1, $11
         )`,
        [
          expansionId,
          projectId,
          directionId,
          expansionTitle,
          "双主角在真实门店场景中完成一段可感知的服务旅程。",
          asJson({
            opening: "客户抵达门店产生疑问。",
            middle: "双主角用产品体验化解顾虑。",
            ending: "品牌价值在真实使用中落地。",
          }),
          asJson(["环境光变化", "服务动作细节", "门店真实陈列"]),
          "写实电影感",
          "medium",
          "需要控制演员关系和真实场景调度。",
          actorId,
        ]
      );
    }

    const generatedImageId = await upsertGeneratedImage(query, {
      projectId,
      actorId,
      directionId,
      expansionId,
      prompt: "UI 巡检样例方向 2 氛围图",
      ossUrl: SAMPLE_IMAGE_URL,
      metadata: { marker: UI_INSPECTION_MARKER, phase: "creative_expansion" },
    });

    const roundByNumber = new Map<number, string>();
    for (const roundNumber of [1, 2] as const) {
      const existingId = await findExistingId(
        query,
        `select id
         from creative_proposal_rounds
         where project_id = $1
           and round_number = $2
         order by version desc, updated_at desc
         limit 1`,
        [projectId, roundNumber]
      );

      if (existingId) {
        await query(
          `update creative_proposal_rounds
           set status = $2,
               direction_ids = $3::jsonb,
               retained_direction_ids = $4::jsonb,
               client_feedback_json = $5::jsonb,
               snapshot_json = $6::jsonb,
               updated_by = $7,
               updated_at = now()
           where id = $1`,
          [
            existingId,
            roundNumber === 1 ? "client_reviewing" : "client_approved",
            asJson(directionIds),
            asJson(roundNumber === 1 ? [directionId, directionIds[2]] : [directionId]),
            asJson(
              roundNumber === 1
                ? { note: "保留方向 2 与方向 3 进入复盘。" }
                : { note: "客户确认方向 2 可进入商业化与脚本阶段。" }
            ),
            asJson({ marker: UI_INSPECTION_MARKER, roundNumber }),
            actorId,
          ]
        );
        roundByNumber.set(roundNumber, existingId);
      } else {
        const inserted = await query<{ id: string }>(
          `insert into creative_proposal_rounds (
             project_id, round_number, status, version, direction_ids, retained_direction_ids,
             client_feedback_json, snapshot_json, created_by, updated_by
           )
           values ($1, $2, $3, 1, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $8)
           returning id`,
          [
            projectId,
            roundNumber,
            roundNumber === 1 ? "client_reviewing" : "client_approved",
            asJson(directionIds),
            asJson(roundNumber === 1 ? [directionId, directionIds[2]] : [directionId]),
            asJson(
              roundNumber === 1
                ? { note: "保留方向 2 与方向 3 进入复盘。" }
                : { note: "客户确认方向 2 可进入商业化与脚本阶段。" }
            ),
            asJson({ marker: UI_INSPECTION_MARKER, roundNumber }),
            actorId,
          ]
        );
        roundByNumber.set(roundNumber, inserted.rows[0].id);
      }
    }

    const roundId = roundByNumber.get(2) ?? roundByNumber.get(1);
    if (!roundId) throw new Error("Failed to seed creative proposal rounds");

    const conceptTitle = "UI 巡检样例视觉场景 01";
    const conceptId =
      (await findExistingId(
        query,
        `select id
         from creative_scene_concepts
         where project_id = $1
           and round_id = $2
           and title = $3
         limit 1`,
        [projectId, roundId, conceptTitle]
      )) ?? randomUUID();

    if ((await findExistingId(query, `select id from creative_scene_concepts where id = $1`, [conceptId])) !== null) {
      await query(
        `update creative_scene_concepts
         set direction_id = $2,
             scene_index = 1,
             description = $3,
             source_text = $4,
             image_prompt = $5,
             required_image_count = 2,
             selected_image_ids = $6::jsonb,
             status = 'selected',
             snapshot_json = $7::jsonb,
             updated_by = $8,
             updated_at = now()
         where id = $1`,
        [
          conceptId,
          directionId,
          "门店入口到服务区的转换，突出真实服务感与品牌信任。",
          "来自 UI 巡检样例方向 2 的视觉深化段落。",
          "真实门店光线，双主角互动，写实电影感。",
          asJson([]),
          asJson({ marker: UI_INSPECTION_MARKER, phase: "scene_concept" }),
          actorId,
        ]
      );
    } else {
      await query(
        `insert into creative_scene_concepts (
           id, project_id, round_id, direction_id, scene_index, title, description,
           source_text, image_prompt, required_image_count, selected_image_ids, status,
           snapshot_json, created_by, updated_by
         )
         values (
           $1, $2, $3, $4, 1, $5, $6, $7, $8, 2, $9::jsonb, 'selected',
           $10::jsonb, $11, $11
         )`,
        [
          conceptId,
          projectId,
          roundId,
          directionId,
          conceptTitle,
          "门店入口到服务区的转换，突出真实服务感与品牌信任。",
          "来自 UI 巡检样例方向 2 的视觉深化段落。",
          "真实门店光线，双主角互动，写实电影感。",
          asJson([]),
          asJson({ marker: UI_INSPECTION_MARKER, phase: "scene_concept" }),
          actorId,
        ]
      );
    }

    await query(
      `delete from creative_scene_images
       where project_id = $1
         and scene_concept_id = $2`,
      [projectId, conceptId]
    );

    for (const [index, status] of ["selected", "generated"].entries()) {
      await query(
        `insert into creative_scene_images (
           project_id, round_id, scene_concept_id, generated_image_id, oss_url, prompt, status, is_selected, sort_order, created_by
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          projectId,
          roundId,
          conceptId,
          generatedImageId,
          SAMPLE_IMAGE_URL,
          `UI 巡检样例视觉场景候选图 ${index + 1}`,
          status,
          status === "selected",
          index + 1,
          actorId,
        ]
      );
    }

    const proposalContent = [
      "# UI 巡检样例：创意视觉提案",
      "方向 2 采用双主角真实叙事，强调门店体验、服务动作与品牌可信度。",
      "第二轮保留该方向并锁定为后续报价与脚本依据。",
    ].join("\n\n");

    const proposalResult = await query<{ id: string; version: number }>(
      `insert into proposals (project_id, title, content, status, version, created_by, updated_by)
       values ($1, $2, $3, 'approved', 1, $4, $4)
       on conflict (project_id)
       do update set
         title = excluded.title,
         content = excluded.content,
         status = excluded.status,
         version = proposals.version,
         updated_by = excluded.updated_by,
         updated_at = now()
       returning id, version`,
      [projectId, "UI 巡检样例：创意提案", proposalContent, actorId]
    );
    const proposalId = proposalResult.rows[0].id;
    const proposalVersion = proposalResult.rows[0].version;
    const proposalSnapshotId = await upsertDocumentSnapshot(query, {
      projectId,
      actorId,
      documentType: "proposal",
      documentId: proposalId,
      title: "UI 巡检样例：创意提案快照",
      version: proposalVersion,
      status: "approved",
      content: proposalContent,
      summary: "用于工作台 SOP 3 卡片巡检的创意提案快照。",
      snapshot: { marker: UI_INSPECTION_MARKER, roundId, directionId },
    });
    await query(`update proposals set latest_snapshot_id = $2, updated_at = now() where id = $1`, [proposalId, proposalSnapshotId]);

    const estimateResult = await query<{ id: string }>(
      `insert into workload_estimates (
         project_id, status, role_count, scene_count, shot_count, image_count, video_count,
         revision_rounds, deliverable_versions, complexity, min_price_cny, max_price_cny,
         rationale, risk_notes, source_round_id, created_by, updated_by
       )
       values (
         $1, 'confirmed', 2, 1, 3, 12, 1, 2, $2::jsonb, 'high', 80000, 120000,
         $3, $4, $5, $6, $6
       )
       on conflict (project_id)
       do update set
         status = excluded.status,
         role_count = excluded.role_count,
         scene_count = excluded.scene_count,
         shot_count = excluded.shot_count,
         image_count = excluded.image_count,
         video_count = excluded.video_count,
         revision_rounds = excluded.revision_rounds,
         deliverable_versions = excluded.deliverable_versions,
         complexity = excluded.complexity,
         min_price_cny = excluded.min_price_cny,
         max_price_cny = excluded.max_price_cny,
         rationale = excluded.rationale,
         risk_notes = excluded.risk_notes,
         source_round_id = excluded.source_round_id,
         updated_by = excluded.updated_by,
         updated_at = now()
       returning id`,
      [
        projectId,
        asJson(["提案首版", "A-copy 一轮", "B-copy 定稿"]),
        "镜头密度高，但可通过单场景复用与双角色调度控制成本。",
        "主要风险在紧排期和素材补充速度。",
        roundId,
        actorId,
      ]
    );
    const estimateId = estimateResult.rows[0].id;

    const quoteItems = [
      { name: "创意与脚本", description: "方向深化、脚本与文字分镜", quantity: 1, unitPrice: 28000 },
      { name: "分镜与参考图", description: "场景概念、角色设定、镜头参考图", quantity: 1, unitPrice: 26000 },
      { name: "视频生成与修改", description: "AI 视频生成与两轮修改", quantity: 1, unitPrice: 42000 },
    ];
    const totalAmount = quoteItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const quoteResult = await query<{ id: string; version: number }>(
      `insert into quotes (
         project_id, title, currency, items_json, notes, total_amount, status, version, created_by, updated_by
       )
       values ($1, $2, 'CNY', $3::jsonb, $4, $5, 'confirmed', 1, $6, $6)
       on conflict (project_id)
       do update set
         title = excluded.title,
         currency = excluded.currency,
         items_json = excluded.items_json,
         notes = excluded.notes,
         total_amount = excluded.total_amount,
         status = excluded.status,
         version = quotes.version,
         updated_by = excluded.updated_by,
         updated_at = now()
       returning id, version`,
      [
        projectId,
        "UI 巡检样例：报价单",
        asJson(quoteItems),
        "UI 巡检样例报价，含创意、分镜、视频生成与两轮修改。",
        totalAmount,
        actorId,
      ]
    );
    const quoteId = quoteResult.rows[0].id;
    const quoteVersion = quoteResult.rows[0].version;
    const quoteSnapshotId = await upsertDocumentSnapshot(query, {
      projectId,
      actorId,
      documentType: "quote",
      documentId: quoteId,
      title: "UI 巡检样例：报价快照",
      version: quoteVersion,
      status: "confirmed",
      content: `总报价：${totalAmount} CNY\n\n${quoteItems.map((item) => `${item.name}：${item.unitPrice} CNY`).join("\n")}`,
      summary: "用于工作台 SOP 4 卡片巡检的报价快照。",
      snapshot: { marker: UI_INSPECTION_MARKER, totalAmount, estimateId },
    });
    await query(`update quotes set latest_snapshot_id = $2, updated_at = now() where id = $1`, [quoteId, quoteSnapshotId]);

    const contractContent = [
      "UI 巡检样例合同",
      "甲方：流程巡检品牌方",
      "乙方：UI 巡检 Agent",
      "付款方式：50% 预付款，验收后 5 天内支付尾款。",
    ].join("\n");

    const contractResult = await query<{ id: string; version: number }>(
      `insert into contracts (
         project_id, proposal_id, quote_id, title, template_key, template_fields_json,
         content, status, version, created_by, updated_by
       )
       values ($1, $2, $3, $4, 'default_aigc_video_contract', $5::jsonb, $6, 'signed', 1, $7, $7)
       on conflict (project_id)
       do update set
         proposal_id = excluded.proposal_id,
         quote_id = excluded.quote_id,
         title = excluded.title,
         template_key = excluded.template_key,
         template_fields_json = excluded.template_fields_json,
         content = excluded.content,
         status = excluded.status,
         version = contracts.version,
         updated_by = excluded.updated_by,
         updated_at = now()
       returning id, version`,
      [
        projectId,
        proposalId,
        quoteId,
        "UI 巡检样例：合同",
        asJson({
          partyAName: "流程巡检品牌方",
          partyBName: "UI 巡检 Agent",
          projectName: PROJECT_NAME,
          quoteTitle: "UI 巡检样例：报价单",
          quoteTotalAmount: totalAmount,
          quoteCurrency: "CNY",
          deliveryScope: "创意提案、脚本分镜、AI 视频首版与修改交付。",
          paymentTerms: "50% 预付款，尾款验收后 5 天内支付。",
          effectiveDate: "2026-06-30",
        }),
        contractContent,
        actorId,
      ]
    );
    const contractId = contractResult.rows[0].id;
    const contractVersion = contractResult.rows[0].version;
    const contractSnapshotId = await upsertDocumentSnapshot(query, {
      projectId,
      actorId,
      documentType: "contract",
      documentId: contractId,
      title: "UI 巡检样例：合同快照",
      version: contractVersion,
      status: "signed",
      content: contractContent,
      summary: "用于工作台 SOP 4 卡片巡检的合同快照。",
      snapshot: { marker: UI_INSPECTION_MARKER, quoteId, proposalId },
    });
    await query(`update contracts set latest_snapshot_id = $2, updated_at = now() where id = $1`, [contractId, contractSnapshotId]);

    const checklistResult = await query<{ id: string }>(
      `insert into delivery_checklists (
         project_id, estimate_id, status, version, notes, confirmed_by, confirmed_at, created_by, updated_by
       )
       values ($1, $2, 'confirmed', 1, $3, $4, now(), $4, $4)
       on conflict (project_id)
       do update set
         estimate_id = excluded.estimate_id,
         status = excluded.status,
         notes = excluded.notes,
         confirmed_by = excluded.confirmed_by,
         confirmed_at = excluded.confirmed_at,
         updated_by = excluded.updated_by,
         updated_at = now()
       returning id`,
      [projectId, estimateId, "UI 巡检样例交付清单，用于 SOP 4 卡片巡检。", actorId]
    );
    const checklistId = checklistResult.rows[0].id;
    await query(`delete from delivery_checklist_items where project_id = $1 and checklist_id = $2`, [projectId, checklistId]);

    const checklistItems = [
      ["proposal", "创意提案 PDF"],
      ["quote", "报价单"],
      ["contract", "合同签署版本"],
      ["script", "脚本与文字分镜"],
      ["review", "客户确认记录"],
    ] as const;
    for (const [index, [itemKind, title]] of checklistItems.entries()) {
      await query(
        `insert into delivery_checklist_items (
           project_id, checklist_id, item_kind, title, description, quantity, status, sort_order, metadata_json, created_by, updated_by
         )
         values ($1, $2, $3, $4, $5, 1, 'confirmed', $6, $7::jsonb, $8, $8)`,
        [
          projectId,
          checklistId,
          itemKind,
          title,
          `UI 巡检样例交付项 ${index + 1}`,
          index + 1,
          asJson({ marker: UI_INSPECTION_MARKER }),
          actorId,
        ]
      );
    }

    const receiverResult = await query<{ id: string }>(
      `insert into project_feishu_receivers (
         project_id, receiver_type, receiver_id, display_name, company_name, contact_role,
         contact_email, is_primary, is_active, notes, created_by, updated_by
       )
       values ($1, 'chat', 'ui-inspection-chat', $2, $3, '客户群', $4, true, true, $5, $6, $6)
       on conflict (project_id, receiver_type, receiver_id)
       do update set
         display_name = excluded.display_name,
         company_name = excluded.company_name,
         contact_role = excluded.contact_role,
         contact_email = excluded.contact_email,
         is_primary = excluded.is_primary,
         is_active = excluded.is_active,
         notes = excluded.notes,
         updated_by = excluded.updated_by,
         updated_at = now()
       returning id`,
      [projectId, "UI 巡检样例客户群", BRAND_NAME, "ui-inspection@example.com", `UI 巡检样例 ${UI_INSPECTION_MARKER}`, actorId]
    );
    const receiverId = receiverResult.rows[0].id;

    const deliveryTitle = "UI 巡检样例 Feishu 交付";
    const existingDeliveryId = await findExistingId(
      query,
      `select id
       from feishu_deliveries
       where project_id = $1
         and document_type = 'contract'
         and title = $2
       limit 1`,
      [projectId, deliveryTitle]
    );

    let deliveryId = existingDeliveryId;
    if (deliveryId) {
      await query(
        `update feishu_deliveries
         set document_id = $2,
             snapshot_id = $3,
             content = $4,
             receiver_type = 'chat',
             receiver_id = 'ui-inspection-chat',
             receiver_name = $5,
             status = 'succeeded',
             feishu_document_token = 'ui_inspection_sample_token',
             feishu_document_url = $6,
             feishu_message_id = 'ui_inspection_sample_message',
             failure_reason = null,
             retry_count = 0,
             created_by = $7,
             sent_at = now(),
             receiver_ref_id = $8,
             updated_at = now()
         where id = $1`,
        [
          deliveryId,
          contractId,
          contractSnapshotId,
          `UI 巡检样例合同已发送，标记：${UI_INSPECTION_MARKER}`,
          "UI 巡检样例客户群",
          "https://feishu.cn/docx/ui_inspection_sample",
          actorId,
          receiverId,
        ]
      );
    } else {
      const inserted = await query<{ id: string }>(
        `insert into feishu_deliveries (
           project_id, document_type, document_id, snapshot_id, title, content, receiver_type,
           receiver_id, receiver_name, status, feishu_document_token, feishu_document_url,
           feishu_message_id, created_by, sent_at, receiver_ref_id
         )
         values (
           $1, 'contract', $2, $3, $4, $5, 'chat', 'ui-inspection-chat', $6, 'succeeded',
           'ui_inspection_sample_token', $7, 'ui_inspection_sample_message', $8, now(), $9
         )
         returning id`,
        [
          projectId,
          contractId,
          contractSnapshotId,
          deliveryTitle,
          `UI 巡检样例合同已发送，标记：${UI_INSPECTION_MARKER}`,
          "UI 巡检样例客户群",
          "https://feishu.cn/docx/ui_inspection_sample",
          actorId,
          receiverId,
        ]
      );
      deliveryId = inserted.rows[0].id;
    }

    await query(
      `update project_feishu_receivers
       set last_delivery_id = $2,
           last_sent_at = now(),
           failure_reason = null,
           updated_at = now()
       where id = $1`,
      [receiverId, deliveryId]
    );

    return { directionId, roundId, quoteId, contractId };
  });
}

async function seedScriptSetupAndStoryboard(
  projectId: string,
  actorId: string,
  directionId: string
): Promise<{ sceneId: string; shotIds: string[]; imageIds: string[] }> {
  const { withTransaction } = await getDb();
  return withTransaction(async (query) => {
    const packageTitle = "UI 巡检样例：脚本设定包";
    const packageId =
      (await findExistingId(
        query,
        `select id
         from script_direction_packages
         where project_id = $1
           and title = $2
         limit 1`,
        [projectId, packageTitle]
      )) ?? randomUUID();

    const packageExists = (await findExistingId(query, `select id from script_direction_packages where id = $1`, [packageId])) !== null;
    const scriptConcept = "围绕双主角在真实门店中的体验推进，完成品牌信任建立。";
    const fullScript = [
      "第一段：客户带着问题走进门店，环境与人流交代真实空间感。",
      "第二段：服务顾问与客户并肩体验产品，重点展示动作细节和产品回应。",
      "第三段：客户完成决策，品牌价值在真实场景中自然落地。",
    ].join("\n");

    if (packageExists) {
      await query(
        `update script_direction_packages
         set direction_id = $2,
             concept = $3,
             full_script = $4,
             status = 'client_approved',
             selected_at = now(),
             created_by = $5,
             updated_by = $5,
             updated_at = now()
         where id = $1`,
        [packageId, directionId, scriptConcept, fullScript, actorId]
      );
    } else {
      await query(
        `insert into script_direction_packages (
           id, project_id, direction_id, title, concept, full_script, status, version, selected_at, created_by, updated_by
         )
         values ($1, $2, $3, $4, $5, $6, 'client_approved', 1, now(), $7, $7)`,
        [packageId, projectId, directionId, packageTitle, scriptConcept, fullScript, actorId]
      );
    }

    const sceneResult = await query<{ id: string }>(
      `insert into storyboard_scenes (
         project_id, package_id, scene_number, title, description, status, created_by, updated_by
       )
       values ($1, $2, 1, $3, $4, 'ready_for_client_review', $5, $5)
       on conflict (project_id, scene_number)
       do update set
         package_id = excluded.package_id,
         title = excluded.title,
         description = excluded.description,
         status = excluded.status,
         updated_by = excluded.updated_by,
         updated_at = now()
       returning id`,
      [projectId, packageId, "UI 巡检样例场景 1", "门店入口到产品体验区的完整服务链路。", actorId]
    );
    const sceneId = sceneResult.rows[0].id;

    await query(`delete from storyboard_shots where project_id = $1 and scene_id = $2`, [projectId, sceneId]);

    const shotIds: string[] = [];
    const shotDefs = [
      {
        shotNumber: "1A",
        visualDescription: "门店入口广角，客户走入空间。",
        shotSize: "wide",
        actionExpression: "客户观察环境并放慢脚步。",
        cameraMovement: "推入",
        durationSeconds: 4,
      },
      {
        shotNumber: "1B",
        visualDescription: "双主角中景互动，服务顾问递出产品。",
        shotSize: "medium",
        actionExpression: "服务顾问讲解，客户点头回应。",
        cameraMovement: "跟拍",
        durationSeconds: 6,
      },
      {
        shotNumber: "1C",
        visualDescription: "产品细节特写，客户完成确认。",
        shotSize: "close",
        actionExpression: "产品灯光点亮，客户露出确认神情。",
        cameraMovement: "轻摇",
        durationSeconds: 5,
      },
    ] as const;

    for (const [index, shot] of shotDefs.entries()) {
      const result = await query<{ id: string }>(
        `insert into storyboard_shots (
           project_id, scene_id, package_id, shot_number, visual_description, shot_size,
           action_expression, camera_movement, duration_seconds, sound_transition, notes,
           character_refs, scene_refs, image_prompt, video_prompt, status, version, sort_order, created_by, updated_by
         )
         values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
           $12::jsonb, $13::jsonb, $14, $15, 'image_ready', 1, $16, $17, $17
         )
         returning id`,
        [
          projectId,
          sceneId,
          packageId,
          shot.shotNumber,
          shot.visualDescription,
          shot.shotSize,
          shot.actionExpression,
          shot.cameraMovement,
          shot.durationSeconds,
          "轻音乐持续",
          "UI 巡检样例镜头备注",
          asJson(["主角 A", "主角 B"]),
          asJson(["门店主场景"]),
          `${shot.visualDescription}，写实电影感，UI 巡检样例`,
          `${shot.visualDescription}，视频生成沿用真实门店节奏`,
          index + 1,
          actorId,
        ]
      );
      shotIds.push(result.rows[0].id);
    }

    const entityDefinitions = [
      {
        entityType: "character",
        name: "UI 巡检样例角色 A",
        description: "门店服务顾问，负责引导与讲解。",
        importance: "key",
        referenceDepth: "full",
        prompt: "UI 巡检样例角色 A 设定图",
        ratio: "3:4",
        sourceShotIds: [shotIds[1]],
      },
      {
        entityType: "character",
        name: "UI 巡检样例角色 B",
        description: "到店客户，体现真实体验与决策过程。",
        importance: "important",
        referenceDepth: "full",
        prompt: "UI 巡检样例角色 B 设定图",
        ratio: "3:4",
        sourceShotIds: [shotIds[0], shotIds[2]],
      },
      {
        entityType: "scene",
        name: "UI 巡检样例门店主场景",
        description: "入口与体验区相连的核心门店空间。",
        importance: "key",
        referenceDepth: "full",
        prompt: "UI 巡检样例门店主场景设定图",
        ratio: "16:9",
        sourceShotIds: shotIds,
      },
    ] as const;

    const imageIds: string[] = [];
    for (const entity of entityDefinitions) {
      const entityId =
        (await findExistingId(
          query,
          `select id
           from production_entities
           where project_id = $1
             and entity_type = $2
             and name = $3
           limit 1`,
          [projectId, entity.entityType, entity.name]
        )) ?? randomUUID();

      const entityExists = (await findExistingId(query, `select id from production_entities where id = $1`, [entityId])) !== null;
      if (entityExists) {
        await query(
          `update production_entities
           set description = $2,
               importance = $3,
               reference_depth = $4,
               source_shot_ids = $5::jsonb,
               status = 'internal_confirmed',
               inclusion_status = 'active',
               ignore_reason = '',
               confirmed_at = now(),
               updated_by = $6,
               updated_at = now()
           where id = $1`,
          [
            entityId,
            entity.description,
            entity.importance,
            entity.referenceDepth,
            asJson(entity.sourceShotIds),
            actorId,
          ]
        );
      } else {
        await query(
          `insert into production_entities (
             id, project_id, entity_type, name, description, importance, reference_depth,
             source_shot_ids, status, inclusion_status, confirmed_at, created_by, updated_by
           )
           values (
             $1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'internal_confirmed', 'active', now(), $9, $9
           )`,
          [
            entityId,
            projectId,
            entity.entityType,
            entity.name,
            entity.description,
            entity.importance,
            entity.referenceDepth,
            asJson(entity.sourceShotIds),
            actorId,
          ]
        );
      }

      const generatedImageId = await upsertGeneratedImage(query, {
        projectId,
        actorId,
        prompt: entity.prompt,
        ossUrl: SAMPLE_IMAGE_URL,
        metadata: {
          marker: UI_INSPECTION_MARKER,
          phase: "production_entity",
          entityType: entity.entityType,
          entityName: entity.name,
        },
      });
      imageIds.push(generatedImageId);

      const referenceSetId =
        (await findExistingId(
          query,
          `select id
           from production_reference_sets
           where project_id = $1
             and entity_id = $2
             and depth = 'full'
           limit 1`,
          [projectId, entityId]
        )) ?? randomUUID();
      const setExists = (await findExistingId(query, `select id from production_reference_sets where id = $1`, [referenceSetId])) !== null;

      if (setExists) {
        await query(
          `update production_reference_sets
           set status = 'internal_confirmed',
               prompt = $2,
               current_prompt = $2,
               reference_image_ids = $3::jsonb,
               selected_image_id = $4,
               default_ratio = $5,
               last_generation_count = 1,
               snapshot_json = $6::jsonb,
               updated_by = $7,
               updated_at = now()
           where id = $1`,
          [
            referenceSetId,
            `${entity.prompt}，标记 ${UI_INSPECTION_MARKER}`,
            asJson([generatedImageId]),
            generatedImageId,
            entity.ratio,
            asJson({ marker: UI_INSPECTION_MARKER, entityName: entity.name }),
            actorId,
          ]
        );
      } else {
        await query(
          `insert into production_reference_sets (
             id, project_id, entity_id, depth, status, prompt, reference_image_ids, current_prompt,
             selected_image_id, default_ratio, last_generation_count, snapshot_json, created_by, updated_by
           )
           values (
             $1, $2, $3, 'full', 'internal_confirmed', $4, $5::jsonb, $4,
             $6, $7, 1, $8::jsonb, $9, $9
           )`,
          [
            referenceSetId,
            projectId,
            entityId,
            `${entity.prompt}，标记 ${UI_INSPECTION_MARKER}`,
            asJson([generatedImageId]),
            generatedImageId,
            entity.ratio,
            asJson({ marker: UI_INSPECTION_MARKER, entityName: entity.name }),
            actorId,
          ]
        );
      }
    }

    return { sceneId, shotIds, imageIds };
  });
}

async function seedStoryboardImageAndVideo(
  projectId: string,
  actorId: string,
  sceneId: string,
  shotIds: string[]
): Promise<void> {
  const { withTransaction } = await getDb();
  await withTransaction(async (query) => {
    const storyboardReviewTitle = "UI 巡检样例：分镜图片审核";
    const storyboardReviewToken = sha256(`${UI_INSPECTION_MARKER}:${projectId}:storyboard_scene_images:${sceneId}`);
    const storyboardReviewCode = sha256(`${UI_INSPECTION_MARKER}:${sceneId}:code`);
    const shotStatuses = ["approved", "needs_revision", "pending"] as const;
    const selectedImageIds: string[] = [];

    for (const [index, shotId] of shotIds.entries()) {
      const prompt = `UI 巡检样例镜头 ${index + 1} 分镜图`;
      const imageId =
        (await findExistingId(
          query,
          `select id
           from storyboard_images
           where project_id = $1
             and shot_id = $2
             and prompt = $3
           limit 1`,
          [projectId, shotId, prompt]
        )) ?? randomUUID();
      const imageExists = (await findExistingId(query, `select id from storyboard_images where id = $1`, [imageId])) !== null;

      if (imageExists) {
        await query(
          `update storyboard_images
           set scene_id = $2,
               prompt = $3,
               provider = $4,
               model_name = $5,
               generation_status = 'succeeded',
               oss_url = $6,
               is_selected = true,
               internal_review_status = 'confirmed',
               failure_reason = null,
               retry_count = 0,
               annotations_json = $7::jsonb,
               reference_json = $8::jsonb,
               version = 1,
               created_by = $9,
               reviewed_by = $9,
               reviewed_at = now(),
               updated_at = now()
           where id = $1`,
          [
            imageId,
            sceneId,
            prompt,
            SAMPLE_PROVIDER,
            SAMPLE_MODEL,
            SAMPLE_IMAGE_URL,
            asJson([{ marker: UI_INSPECTION_MARKER, status: shotStatuses[index] ?? "pending" }]),
            asJson({ marker: UI_INSPECTION_MARKER, sceneId, shotId }),
            actorId,
          ]
        );
      } else {
        await query(
          `insert into storyboard_images (
             id, project_id, scene_id, shot_id, prompt, provider, model_name,
             generation_status, oss_url, is_selected, internal_review_status,
             annotations_json, reference_json, version, created_by, reviewed_by, reviewed_at
           )
           values (
             $1, $2, $3, $4, $5, $6, $7,
             'succeeded', $8, true, 'confirmed',
             $9::jsonb, $10::jsonb, 1, $11, $11, now()
           )`,
          [
            imageId,
            projectId,
            sceneId,
            shotId,
            prompt,
            SAMPLE_PROVIDER,
            SAMPLE_MODEL,
            SAMPLE_IMAGE_URL,
            asJson([{ marker: UI_INSPECTION_MARKER, status: shotStatuses[index] ?? "pending" }]),
            asJson({ marker: UI_INSPECTION_MARKER, sceneId, shotId }),
            actorId,
          ]
        );
      }
      selectedImageIds.push(imageId);

      await query(
        `insert into storyboard_image_versions (
           project_id, scene_id, shot_id, storyboard_image_id, version, selected_image_ids, status, snapshot_json, created_by
         )
         values ($1, $2, $3, $4, 1, $5::jsonb, 'selected', $6::jsonb, $7)
         on conflict (shot_id, version)
         do update set
           scene_id = excluded.scene_id,
           storyboard_image_id = excluded.storyboard_image_id,
           selected_image_ids = excluded.selected_image_ids,
           status = excluded.status,
           snapshot_json = excluded.snapshot_json,
           created_by = excluded.created_by,
           updated_at = now()`,
        [
          projectId,
          sceneId,
          shotId,
          imageId,
          asJson([imageId]),
          asJson({ marker: UI_INSPECTION_MARKER, batch: 1, shotId }),
          actorId,
        ]
      );
    }

    const reviewTaskResult = await query<{ id: string }>(
      `insert into client_review_tasks (
         project_id, module_key, review_type, target_scope_type, target_scope_id, title, summary,
         version, status, access_token_hash, verification_code_hash, expires_at, submitted_at,
         reviewed_at, payload_json, decision_payload_json, reviewer_name, reviewer_contact, feedback, created_by
       )
       values (
         $1, 'storyboard_image_canvas', 'storyboard_scene_images', 'storyboard_scene', $2, $3, $4,
         1, 'approved', $5, $6, now() + interval '30 days', now(),
         now(), $7::jsonb, $8::jsonb, 'UI 巡检客户', 'ui-review@example.com', $9, $10
       )
       on conflict (access_token_hash)
       do update set
         title = excluded.title,
         summary = excluded.summary,
         status = excluded.status,
         expires_at = excluded.expires_at,
         submitted_at = excluded.submitted_at,
         reviewed_at = excluded.reviewed_at,
         payload_json = excluded.payload_json,
         decision_payload_json = excluded.decision_payload_json,
         reviewer_name = excluded.reviewer_name,
         reviewer_contact = excluded.reviewer_contact,
         feedback = excluded.feedback,
         created_by = excluded.created_by,
         updated_at = now()
       returning id`,
      [
        projectId,
        sceneId,
        storyboardReviewTitle,
        "UI 巡检样例分镜图片三批审核任务。",
        storyboardReviewToken,
        storyboardReviewCode,
        asJson({ marker: UI_INSPECTION_MARKER, sceneId, shotIds, selectedImageIds }),
        asJson({ marker: UI_INSPECTION_MARKER, outcome: "mixed_feedback" }),
        "已完成第一批审核，含通过与待修改镜头。",
        actorId,
      ]
    );
    const reviewTaskId = reviewTaskResult.rows[0].id;

    await query(
      `delete from client_review_items
       where review_task_id = $1
         and project_id = $2
         and item_type = 'storyboard_shot_image'`,
      [reviewTaskId, projectId]
    );

    for (const [index, shotId] of shotIds.entries()) {
      await query(
        `insert into client_review_items (
           review_task_id, project_id, item_type, item_id, item_label, decision, score, feedback, metadata_json
         )
         values ($1, $2, 'storyboard_shot_image', $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          reviewTaskId,
          projectId,
          shotId,
          `UI 巡检样例镜头 ${index + 1}`,
          shotStatuses[index] === "approved" ? "approved" : shotStatuses[index] === "needs_revision" ? "rejected" : "pending",
          shotStatuses[index] === "approved" ? 5 : shotStatuses[index] === "needs_revision" ? 2 : null,
          shotStatuses[index] === "approved"
            ? "画面可直接进入锁版。"
            : shotStatuses[index] === "needs_revision"
              ? "客户希望强化角色动作与产品交互。"
              : "等待客户进一步确认。",
          asJson({ marker: UI_INSPECTION_MARKER, sceneId, shotId }),
        ]
      );
    }

    for (const batchNumber of [1, 2, 3] as const) {
      const batchStatus =
        batchNumber === 1 ? "client_reviewing" : batchNumber === 2 ? "client_rejected" : "internal_ready";
      const batchId =
        (await findExistingId(
          query,
          `select id
           from storyboard_image_batches
           where project_id = $1
             and batch_number = $2
             and version = 1
           limit 1`,
          [projectId, batchNumber]
        )) ?? randomUUID();
      const batchExists = (await findExistingId(query, `select id from storyboard_image_batches where id = $1`, [batchId])) !== null;

      if (batchExists) {
        await query(
          `update storyboard_image_batches
           set status = $2,
               scene_ids = $3::jsonb,
               client_review_task_id = $4,
               snapshot_json = $5::jsonb,
               submitted_at = case when $2 in ('client_reviewing', 'client_rejected', 'client_approved', 'locked') then now() else null end,
               approved_at = case when $2 in ('client_approved', 'locked') then now() else null end,
               updated_by = $6,
               updated_at = now()
           where id = $1`,
          [batchId, batchStatus, asJson([sceneId]), batchNumber === 1 ? reviewTaskId : null, asJson({ marker: UI_INSPECTION_MARKER, batchNumber }), actorId]
        );
      } else {
        await query(
          `insert into storyboard_image_batches (
             id, project_id, batch_number, status, version, scene_ids, client_review_task_id,
             snapshot_json, submitted_at, approved_at, created_by, updated_by
           )
           values (
             $1, $2, $3, $4, 1, $5::jsonb, $6,
             $7::jsonb,
             case when $4 in ('client_reviewing', 'client_rejected', 'client_approved', 'locked') then now() else null end,
             case when $4 in ('client_approved', 'locked') then now() else null end,
             $8, $8
           )`,
          [batchId, projectId, batchNumber, batchStatus, asJson([sceneId]), batchNumber === 1 ? reviewTaskId : null, asJson({ marker: UI_INSPECTION_MARKER, batchNumber }), actorId]
        );
      }

      if (batchNumber === 1) {
        await query(
          `delete from storyboard_image_batch_items
           where batch_id = $1
             and project_id = $2`,
          [batchId, projectId]
        );

        for (const [index, shotId] of shotIds.entries()) {
          await query(
            `insert into storyboard_image_batch_items (
               project_id, batch_id, scene_id, shot_id, status, selected_image_ids, feedback,
               feedback_payload_json, version, sort_order, created_by, updated_by
             )
             values (
               $1, $2, $3, $4, $5, $6::jsonb, $7,
               $8::jsonb, 1, $9, $10, $10
             )`,
            [
              projectId,
              batchId,
              sceneId,
              shotId,
              shotStatuses[index] ?? "pending",
              asJson([selectedImageIds[index]]),
              shotStatuses[index] === "approved"
                ? "构图与动作已通过。"
                : shotStatuses[index] === "needs_revision"
                  ? "表情和手势需要再推进一版。"
                  : "待客户评审会议确认。",
              asJson({ marker: UI_INSPECTION_MARKER, shotId, status: shotStatuses[index] ?? "pending" }),
              index + 1,
              actorId,
            ]
          );
        }
      }
    }

    const firstShotId = shotIds[0];
    const firstImageId = selectedImageIds[0];
    const videoModes = ["single_image", "start_end_frame"] as const;

    for (const [index, mode] of videoModes.entries()) {
      const prompt = `UI 巡检样例视频候选 ${index + 1}`;
      const videoId =
        (await findExistingId(
          query,
          `select id
           from storyboard_videos
           where project_id = $1
             and shot_id = $2
             and prompt = $3
           limit 1`,
          [projectId, firstShotId, prompt]
        )) ?? randomUUID();
      const videoExists = (await findExistingId(query, `select id from storyboard_videos where id = $1`, [videoId])) !== null;

      if (videoExists) {
        await query(
          `update storyboard_videos
           set scene_id = $2,
               image_id = $3,
               prompt = $4,
               provider = $5,
               model_name = $6,
               generation_status = 'succeeded',
               oss_url = $7,
               is_selected = $8,
               internal_review_status = 'confirmed',
               failure_reason = null,
               retry_count = 0,
               version = 1,
               created_by = $9,
               reviewed_by = $9,
               reviewed_at = now(),
               updated_at = now()
           where id = $1`,
          [videoId, sceneId, firstImageId, prompt, SAMPLE_PROVIDER, SAMPLE_MODEL, SAMPLE_VIDEO_URL, index === 0, actorId]
        );
      } else {
        await query(
          `insert into storyboard_videos (
             id, project_id, scene_id, shot_id, image_id, prompt, provider, model_name,
             generation_status, oss_url, is_selected, internal_review_status, version, created_by, reviewed_by, reviewed_at
           )
           values (
             $1, $2, $3, $4, $5, $6, $7, $8,
             'succeeded', $9, $10, 'confirmed', 1, $11, $11, now()
           )`,
          [videoId, projectId, sceneId, firstShotId, firstImageId, prompt, SAMPLE_PROVIDER, SAMPLE_MODEL, SAMPLE_VIDEO_URL, index === 0, actorId]
        );
      }

      await query(
        `delete from storyboard_video_generation_inputs
         where storyboard_video_id = $1
           and project_id = $2`,
        [videoId, projectId]
      );

      await query(
        `insert into storyboard_video_generation_inputs (
           project_id, storyboard_video_id, shot_id, mode, input_image_ids, prompt, metadata_json, created_by
         )
         values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)`,
        [
          projectId,
          videoId,
          firstShotId,
          mode,
          asJson(mode === "single_image" ? [firstImageId] : [firstImageId, selectedImageIds[1] ?? firstImageId]),
          `${prompt} 输入模式 ${mode}`,
          asJson({ marker: UI_INSPECTION_MARKER, mode }),
          actorId,
        ]
      );
    }
  });
}

async function seedReviewCutsAndArchive(projectId: string, actorId: string) {
  const { withTransaction } = await getDb();
  await withTransaction(async (query) => {
    const checklist = await query<{ id: string }>(
      `select id
       from delivery_checklists
       where project_id = $1
       limit 1`,
      [projectId]
    );
    const checklistId = checklist.rows[0]?.id ?? null;

    const reviewCutDefinitions = [
      {
        cutType: "a_copy",
        title: "UI 巡检样例 A Copy",
        description: "第一版完整成片，进入多轮修改。",
        status: "revision_required",
        version: 1,
      },
      {
        cutType: "b_copy",
        title: "UI 巡检样例 B Copy",
        description: "最终定稿版本，等待交付清单核对。",
        status: "client_approved",
        version: 1,
      },
    ] as const;

    for (const [index, cut] of reviewCutDefinitions.entries()) {
      const assetId = await upsertAsset(query, {
        projectId,
        actorId,
        fileName: `${cut.title}.mp4`,
        assetType: "video",
        sourceType: "external",
        parseStatus: "succeeded",
        externalUrl: SAMPLE_VIDEO_URL,
        externalProvider: SAMPLE_PROVIDER,
        mimeType: "video/mp4",
      });

      const reviewType = cut.cutType === "a_copy" ? "a_copy_review" : "b_copy_review";
      const reviewToken = sha256(`${UI_INSPECTION_MARKER}:${projectId}:${reviewType}:${cut.cutType}`);
      const reviewCode = sha256(`${UI_INSPECTION_MARKER}:${cut.cutType}:code`);
      const cutResult = await query<{ id: string }>(
        `insert into review_cuts (
           project_id, cut_type, title, description, asset_id, video_url, duration_seconds,
           status, version, created_by, reviewed_by, reviewed_at
         )
         values ($1, $2, $3, $4, $5, $6, 45, $7, $8, $9, $9, now())
         on conflict (project_id, cut_type, version)
         do update set
           title = excluded.title,
           description = excluded.description,
           asset_id = excluded.asset_id,
           video_url = excluded.video_url,
           duration_seconds = excluded.duration_seconds,
           status = excluded.status,
           created_by = excluded.created_by,
           reviewed_by = excluded.reviewed_by,
           reviewed_at = excluded.reviewed_at,
           updated_at = now()
         returning id`,
        [projectId, cut.cutType, cut.title, cut.description, assetId, SAMPLE_VIDEO_URL, cut.status, cut.version, actorId]
      );
      const reviewCutId = cutResult.rows[0].id;

      const taskResult = await query<{ id: string }>(
        `insert into client_review_tasks (
           project_id, module_key, review_type, target_scope_type, target_scope_id, title, summary,
           version, status, access_token_hash, verification_code_hash, expires_at, submitted_at,
           reviewed_at, payload_json, decision_payload_json, reviewer_name, reviewer_contact, feedback, created_by
         )
         values (
           $1, $2, $3, 'review_cut', $4, $5, $6,
           1, $7, $8, $9, now() + interval '30 days', now(),
           case when $7 = 'active' then null else now() end,
           $10::jsonb, $11::jsonb, 'UI 巡检客户', 'ui-review@example.com', $12, $13
         )
         on conflict (access_token_hash)
         do update set
           title = excluded.title,
           summary = excluded.summary,
           status = excluded.status,
           expires_at = excluded.expires_at,
           submitted_at = excluded.submitted_at,
           reviewed_at = excluded.reviewed_at,
           payload_json = excluded.payload_json,
           decision_payload_json = excluded.decision_payload_json,
           reviewer_name = excluded.reviewer_name,
           reviewer_contact = excluded.reviewer_contact,
           feedback = excluded.feedback,
           created_by = excluded.created_by,
           updated_at = now()
         returning id`,
        [
          projectId,
          cut.cutType === "a_copy" ? "a_copy_revision" : "b_copy_final_confirmation",
          reviewType,
          reviewCutId,
          `${cut.title} 客户审核`,
          cut.cutType === "a_copy" ? "A copy 多轮修改审核任务。" : "B copy 最终确认审核任务。",
          cut.cutType === "a_copy" ? "submitted" : "approved",
          reviewToken,
          reviewCode,
          asJson({ marker: UI_INSPECTION_MARKER, reviewCutId, cutType: cut.cutType }),
          asJson({ marker: UI_INSPECTION_MARKER, finalDecision: cut.cutType === "a_copy" ? "revise" : "approve" }),
          cut.cutType === "a_copy" ? "请优化 12 秒和 28 秒附近的节奏。" : "客户确认可直接交付。",
          actorId,
        ]
      );
      const reviewTaskId = taskResult.rows[0].id;

      await query(`update review_cuts set client_review_task_id = $2, updated_at = now() where id = $1`, [reviewCutId, reviewTaskId]);

      await query(
        `delete from client_review_items
         where review_task_id = $1
           and project_id = $2
           and item_type = 'review_cut_video'`,
        [reviewTaskId, projectId]
      );
      await query(
        `insert into client_review_items (
           review_task_id, project_id, item_type, item_id, item_label, decision, score, feedback, metadata_json
         )
         values (
           $1, $2, 'review_cut_video', $3, $4, $5, $6, $7, $8::jsonb
         )`,
        [
          reviewTaskId,
          projectId,
          reviewCutId,
          cut.title,
          cut.cutType === "a_copy" ? "rejected" : "approved",
          cut.cutType === "a_copy" ? 3 : 5,
          cut.cutType === "a_copy" ? "整体方向成立，但节奏和字幕层次仍需优化。" : "客户确认最终版可进入交付。",
          asJson({ marker: UI_INSPECTION_MARKER, cutType: cut.cutType }),
        ]
      );

      await query(`delete from review_cut_annotations where project_id = $1 and review_cut_id = $2`, [projectId, reviewCutId]);
      if (cut.cutType === "a_copy") {
        const annotations = [
          { timeSeconds: 12, feedback: "这里角色入镜偏慢，建议提前切入产品动作。", status: "mapped" },
          { timeSeconds: 28, feedback: "字幕与口播信息密度过高，需要拆分。", status: "resolved" },
          { timeSeconds: 34, feedback: "收尾品牌露出希望更坚定一点。", status: "needs_triage" },
        ] as const;
        for (const annotation of annotations) {
          await query(
            `insert into review_cut_annotations (
               project_id, review_cut_id, review_task_id, time_seconds, feedback,
               mapping_confidence, status, created_by_name
             )
             values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [projectId, reviewCutId, reviewTaskId, annotation.timeSeconds, annotation.feedback, 0.82, annotation.status, "UI 巡检客户"]
          );
        }
      }

      if (cut.cutType === "a_copy") {
        await query(
          `insert into change_requests (
             project_id, source_sop, source_object_type, source_object_id, status, original_scope,
             requested_scope, impact_json, decision_reason, decided_by, decided_at, created_by, updated_by
           )
           values (
             $1, 'sop8_a_copy_revision', 'review_cut', $2, 'implemented', $3,
             $4, $5::jsonb, $6, $7, now(), $7, $7
           )
           on conflict do nothing`,
          [
            projectId,
            reviewCutId,
            "A copy 第一版完整交付。",
            "优化镜头 12 秒节奏，并降低 28 秒字幕负担。",
            asJson({ marker: UI_INSPECTION_MARKER, rounds: 2, impact: "minor_edit" }),
            "客户反馈已纳入 B copy 定稿版本。",
            actorId,
          ]
        );
      }
    }

    if (checklistId) {
      await query(
        `delete from delivery_checklist_items
         where project_id = $1
           and checklist_id = $2
           and title in ('横版成片', '竖版成片', '无字幕版成片', '封面图', '项目过程文件', 'AI 生成资产归档', '其他补充资料')`,
        [projectId, checklistId]
      );

      const archiveChecklistItems = [
        ["horizontal_final", "横版成片", "最终交付横版视频", "delivered"],
        ["vertical_final", "竖版成片", "最终交付竖版视频", "delivered"],
        ["no_subtitle_final", "无字幕版成片", "无字幕清洁版视频", "confirmed"],
        ["cover", "封面图", "项目交付封面图", "delivered"],
        ["project_file", "项目过程文件", "工程文件与时间线归档", "confirmed"],
        ["generated_assets", "AI 生成资产归档", "分镜图与视频素材归档", "confirmed"],
        ["other", "其他补充资料", "交付说明与归档备注", "planned"],
      ] as const;

      for (const [index, [itemKind, title, description, status]] of archiveChecklistItems.entries()) {
        await query(
          `insert into delivery_checklist_items (
             project_id, checklist_id, item_kind, title, description, quantity, status, sort_order, metadata_json, created_by, updated_by
           )
           values ($1, $2, $3, $4, $5, 1, $6, $7, $8::jsonb, $9, $9)`,
          [projectId, checklistId, itemKind, title, description, status, index + 10, asJson({ marker: UI_INSPECTION_MARKER, stage: "archive" }), actorId]
        );
      }
    }

    await query(
      `insert into archive_records (
         project_id, status, final_files_ready, final_technical_check_passed, tail_payment_confirmed,
         client_received_confirmed, rights_confirmed, case_study_permission, nas_archive_completed,
         delivery_channel, archive_location, after_sales_note, created_by, updated_by
       )
       values (
         $1, 'ready', true, true, false,
         true, true, 'allowed', false,
         'Feishu + OSS', 'oss://ui-inspection/archive/final-package', $2, $3, $3
       )
       on conflict (project_id)
       do update set
         status = excluded.status,
         final_files_ready = excluded.final_files_ready,
         final_technical_check_passed = excluded.final_technical_check_passed,
         tail_payment_confirmed = excluded.tail_payment_confirmed,
         client_received_confirmed = excluded.client_received_confirmed,
         rights_confirmed = excluded.rights_confirmed,
         case_study_permission = excluded.case_study_permission,
         nas_archive_completed = excluded.nas_archive_completed,
         delivery_channel = excluded.delivery_channel,
         archive_location = excluded.archive_location,
         after_sales_note = excluded.after_sales_note,
         updated_by = excluded.updated_by,
         updated_at = now()`,
      [projectId, "尾款待确认，归档卡片应保留一项可执行动作。", actorId]
    );
  });
}

async function main() {
  const { withTransaction } = await getDb();
  const { actorId, projectId } = await withTransaction(async (query) => {
    const actorId = await ensureSeedActor(query);
    const projectId = await ensureUiInspectionProject(actorId, query);
    await seedStageStates(projectId, query);
    return { actorId, projectId };
  });
  await seedBriefAndRisk(projectId, actorId);
  const commercial = await seedCreativeAndCommercial(projectId, actorId);
  const script = await seedScriptSetupAndStoryboard(projectId, actorId, commercial.directionId);
  await seedStoryboardImageAndVideo(projectId, actorId, script.sceneId, script.shotIds);
  await seedReviewCutsAndArchive(projectId, actorId);
  console.log(JSON.stringify({ ok: true, projectId, marker: UI_INSPECTION_MARKER }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "UI inspection seed failed");
  process.exit(1);
});
