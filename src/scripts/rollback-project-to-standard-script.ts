/**
 * Roll a single project back to SOP5 "standard script ready, storyboard not split yet".
 *
 * Usage:
 *   npm run rollback:standard-script -- --projectId=<project-uuid>
 *   PROJECT_ID=<project-uuid> npm run rollback:standard-script
 *   KEEP_STANDARDIZED_SCRIPT=false PROJECT_ID=<project-uuid> npm run rollback:standard-script
 *
 * The script writes a JSON backup under .tmp/rollback-project-to-standard-script/
 * before modifying rows. It only affects the provided projectId.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

loadEnvConfig(process.cwd());

type AnyRow = QueryResultRow & Record<string, unknown>;

const downstreamStageKeys = [
  "storyboard_image_canvas",
  "ai_video_canvas",
  "a_copy_revision",
  "b_copy_final_confirmation",
  "settlement_delivery_archive",
];

function readArg(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();

  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index >= 0) return process.argv[index + 1]?.trim() ?? "";
  return "";
}

function readProjectId() {
  return readArg("projectId") || readArg("project-id") || process.env.PROJECT_ID?.trim() || "";
}

function readKeepStandardizedScript() {
  const value = readArg("keepStandardizedScript") || readArg("keep-standardized-script") || process.env.KEEP_STANDARDIZED_SCRIPT;
  return value === undefined || !["false", "0", "no"].includes(value.trim().toLowerCase());
}

function assertUuid(value: string, label: string) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return;
  throw new Error(`${label} 必须是合法 UUID。`);
}

function configuredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl || databaseUrl.includes("PASTE_") || databaseUrl.includes("YOUR_DATABASE_PASSWORD")) {
    throw new Error("DATABASE_URL 未配置为真实 Postgres 连接串，已停止回退。");
  }
  return databaseUrl;
}

async function selectRows<T extends AnyRow>(client: PoolClient, sql: string, params: unknown[]) {
  const result = await client.query<T>(sql, params);
  return result.rows;
}

async function deleteRows(client: PoolClient, sql: string, params: unknown[]) {
  const result = await client.query<{ id: string }>(sql, params);
  return result.rowCount ?? 0;
}

function collectReferenceImageIds(referenceSets: AnyRow[]) {
  const ids = new Set<string>();
  for (const set of referenceSets) {
    const selectedImageId = typeof set.selected_image_id === "string" ? set.selected_image_id : "";
    if (selectedImageId) ids.add(selectedImageId);

    const imageIds = Array.isArray(set.reference_image_ids) ? set.reference_image_ids : [];
    for (const imageId of imageIds) {
      if (typeof imageId === "string" && imageId) ids.add(imageId);
    }
  }
  return [...ids];
}

async function main() {
  const projectId = readProjectId();
  if (!projectId) {
    throw new Error("缺少 projectId。请使用 PROJECT_ID=<uuid> 或 --projectId=<uuid> 指定单个项目。");
  }
  assertUuid(projectId, "projectId");

  const keepStandardizedScript = readKeepStandardizedScript();
  const databaseUrl = configuredDatabaseUrl();
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=require") ? undefined : { rejectUnauthorized: false },
  });

  const backupDir = path.join(process.cwd(), ".tmp", "rollback-project-to-standard-script");
  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${projectId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const project = (await selectRows(client, `select * from projects where id = $1 for update`, [projectId]))[0];
    if (!project) {
      throw new Error(`未找到项目 ${projectId}，未执行任何回退。`);
    }

    const latestPackage = (
      await selectRows(
        client,
        `select *
           from script_direction_packages
          where project_id = $1
            and status <> 'archived'
          order by updated_at desc
          limit 1
          for update`,
        [projectId],
      )
    )[0];
    if (!latestPackage?.id || typeof latestPackage.id !== "string") {
      throw new Error(`项目 ${projectId} 没有可回退的脚本包。`);
    }
    const packageId = latestPackage.id;

    const storyboardScenes = await selectRows(client, `select * from storyboard_scenes where project_id = $1`, [projectId]);
    const storyboardShots = await selectRows(client, `select * from storyboard_shots where project_id = $1`, [projectId]);
    const sceneIds = storyboardScenes.map((row) => row.id).filter((id): id is string => typeof id === "string");
    const shotIds = storyboardShots.map((row) => row.id).filter((id): id is string => typeof id === "string");

    const productionEntities = await selectRows(client, `select * from production_entities where project_id = $1`, [projectId]);
    const entityIds = productionEntities.map((row) => row.id).filter((id): id is string => typeof id === "string");
    const productionReferenceSets = await selectRows(client, `select * from production_reference_sets where project_id = $1`, [projectId]);
    const referenceImageIds = collectReferenceImageIds(productionReferenceSets);

    const scriptReviewTasks = await selectRows(
      client,
      `select *
         from client_review_tasks
        where project_id = $1
          and review_type = 'script_package'
          and (
            target_scope_id = $2::uuid
            or (review_scene = 'production_setup' and target_scope_id = any($3::uuid[]))
          )`,
      [projectId, packageId, entityIds],
    );
    const scriptReviewTaskIds = scriptReviewTasks.map((row) => row.id).filter((id): id is string => typeof id === "string");

    const formatArtifacts = await selectRows(
      client,
      `select *
         from artifacts
        where project_id = $1
          and kind = 'script_direction_package'
          and data_json ->> 'packageId' = $2
          and data_json ->> 'operation' in ('script_format_standardization', 'script_format_check')`,
      [projectId, packageId],
    );
    const formatArtifactIds = formatArtifacts.map((row) => row.id).filter((id): id is string => typeof id === "string");

    const storyboardImageBatches = await selectRows(client, `select * from storyboard_image_batches where project_id = $1`, [projectId]);
    const storyboardImageBatchIds = storyboardImageBatches.map((row) => row.id).filter((id): id is string => typeof id === "string");
    const storyboardVideos = await selectRows(client, `select * from storyboard_videos where project_id = $1`, [projectId]);
    const storyboardVideoIds = storyboardVideos.map((row) => row.id).filter((id): id is string => typeof id === "string");

    const backup = {
      generatedAt: new Date().toISOString(),
      projectId,
      keepStandardizedScript,
      project,
      latestPackage,
      projectStageStates: await selectRows(
        client,
        `select * from project_stage_states where project_id = $1 and stage_key = any($2::text[])`,
        [projectId, ["script_storyboard_confirmation", ...downstreamStageKeys]],
      ),
      storyboardScenes,
      storyboardShots,
      storyboardImages: await selectRows(client, `select * from storyboard_images where project_id = $1`, [projectId]),
      storyboardVideos,
      storyboardImageBatches,
      storyboardImageBatchItems: await selectRows(client, `select * from storyboard_image_batch_items where project_id = $1`, [projectId]),
      storyboardImageVersions: await selectRows(client, `select * from storyboard_image_versions where project_id = $1`, [projectId]),
      storyboardVideoGenerationInputs: await selectRows(client, `select * from storyboard_video_generation_inputs where project_id = $1`, [projectId]),
      productionEntities,
      productionReferenceSets,
      productionReferenceImages: referenceImageIds.length
        ? await selectRows(client, `select * from generated_images where project_id = $1 and id = any($2::uuid[])`, [projectId, referenceImageIds])
        : [],
      scriptReviewTasks,
      scriptReviewItems: scriptReviewTaskIds.length
        ? await selectRows(client, `select * from client_review_items where project_id = $1 and review_task_id = any($2::uuid[])`, [projectId, scriptReviewTaskIds])
        : [],
      formatArtifacts,
      artifactEvents: formatArtifactIds.length
        ? await selectRows(client, `select * from artifact_events where artifact_id = any($1::uuid[])`, [formatArtifactIds])
        : [],
    };

    await writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");

    const deleted: Record<string, number> = {};
    deleted.clientReviewItems = scriptReviewTaskIds.length
      ? await deleteRows(client, `delete from client_review_items where project_id = $1 and review_task_id = any($2::uuid[]) returning id`, [projectId, scriptReviewTaskIds])
      : 0;
    deleted.clientReviewTasks = scriptReviewTaskIds.length
      ? await deleteRows(client, `delete from client_review_tasks where project_id = $1 and id = any($2::uuid[]) returning id`, [projectId, scriptReviewTaskIds])
      : 0;
    deleted.artifactEvents = formatArtifactIds.length
      ? await deleteRows(client, `delete from artifact_events where artifact_id = any($1::uuid[]) returning id`, [formatArtifactIds])
      : 0;
    deleted.formatArtifacts = formatArtifactIds.length
      ? await deleteRows(client, `delete from artifacts where project_id = $1 and id = any($2::uuid[]) returning id`, [projectId, formatArtifactIds])
      : 0;

    deleted.storyboardVideoGenerationInputs = storyboardVideoIds.length || shotIds.length
      ? await deleteRows(
          client,
          `delete from storyboard_video_generation_inputs
            where project_id = $1
              and (storyboard_video_id = any($2::uuid[]) or shot_id = any($3::uuid[]))
            returning id`,
          [projectId, storyboardVideoIds, shotIds],
        )
      : 0;
    deleted.storyboardImageBatchItems = storyboardImageBatchIds.length || sceneIds.length || shotIds.length
      ? await deleteRows(
          client,
          `delete from storyboard_image_batch_items
            where project_id = $1
              and (batch_id = any($2::uuid[]) or scene_id = any($3::uuid[]) or shot_id = any($4::uuid[]))
            returning id`,
          [projectId, storyboardImageBatchIds, sceneIds, shotIds],
        )
      : 0;
    deleted.storyboardImageBatches = await deleteRows(client, `delete from storyboard_image_batches where project_id = $1 returning id`, [projectId]);
    deleted.storyboardImageVersions = sceneIds.length || shotIds.length
      ? await deleteRows(
          client,
          `delete from storyboard_image_versions
            where project_id = $1
              and (scene_id = any($2::uuid[]) or shot_id = any($3::uuid[]))
            returning id`,
          [projectId, sceneIds, shotIds],
        )
      : 0;
    deleted.storyboardVideos = await deleteRows(client, `delete from storyboard_videos where project_id = $1 returning id`, [projectId]);
    deleted.storyboardImages = await deleteRows(client, `delete from storyboard_images where project_id = $1 returning id`, [projectId]);
    deleted.storyboardShots = await deleteRows(client, `delete from storyboard_shots where project_id = $1 returning id`, [projectId]);
    deleted.storyboardScenes = await deleteRows(client, `delete from storyboard_scenes where project_id = $1 returning id`, [projectId]);
    deleted.productionReferenceSets = await deleteRows(client, `delete from production_reference_sets where project_id = $1 returning id`, [projectId]);
    deleted.productionEntities = await deleteRows(client, `delete from production_entities where project_id = $1 returning id`, [projectId]);
    deleted.productionReferenceImages = referenceImageIds.length
      ? await deleteRows(client, `delete from generated_images where project_id = $1 and id = any($2::uuid[]) returning id`, [projectId, referenceImageIds])
      : 0;

    const targetPackageStatus = keepStandardizedScript ? "internal_review" : "draft";
    const updatedPackage = (
      await selectRows(
        client,
        `update script_direction_packages
            set status = $3,
                standardized_script = case when $4::boolean then standardized_script else '' end,
                locked_at = null,
                updated_at = case
                  when status <> $3
                    or locked_at is not null
                    or (not $4::boolean and standardized_script <> '')
                  then now()
                  else updated_at
                end
          where project_id = $1
            and id = $2
          returning *`,
        [projectId, packageId, targetPackageStatus, keepStandardizedScript],
      )
    )[0];

    await client.query(
      `update projects
          set current_stage = 'script_storyboard_confirmation',
              status = 'in_progress',
              updated_at = case
                when current_stage <> 'script_storyboard_confirmation' or status <> 'in_progress'
                then now()
                else updated_at
              end
        where id = $1`,
      [projectId],
    );

    await client.query(
      `insert into project_stage_states (
         project_id, stage_key, status, started_at, completed_at,
         error_message, input_refs, output_refs, snapshot
       )
       values (
         $1, 'script_storyboard_confirmation', 'in_progress', now(), null,
         null, '[]'::jsonb, '[]'::jsonb,
         $2::jsonb
       )
       on conflict (project_id, stage_key) do nothing`,
      [
        projectId,
        JSON.stringify({
          operation: "rollback_project_to_standard_script",
          packageId,
          keepStandardizedScript,
          userMessage: "已回退到标准剧本步骤。",
        }),
      ],
    );

    await client.query(
      `update project_stage_states
          set status = 'in_progress',
              completed_at = null,
              error_message = null,
              input_refs = '[]'::jsonb,
              output_refs = '[]'::jsonb,
              snapshot = $2::jsonb,
              updated_at = case
                when status <> 'in_progress'
                  or completed_at is not null
                  or error_message is not null
                  or snapshot <> $2::jsonb
                then now()
                else updated_at
              end
        where project_id = $1
          and stage_key = 'script_storyboard_confirmation'`,
      [
        projectId,
        JSON.stringify({
          operation: "rollback_project_to_standard_script",
          packageId,
          keepStandardizedScript,
          userMessage: "已回退到标准剧本步骤。",
        }),
      ],
    );

    await client.query(
      `update project_stage_states
          set status = 'not_started',
              completed_at = null,
              error_message = null,
              input_refs = '[]'::jsonb,
              output_refs = '[]'::jsonb,
              snapshot = '{}'::jsonb,
              updated_at = case
                when status <> 'not_started'
                  or completed_at is not null
                  or error_message is not null
                  or input_refs <> '[]'::jsonb
                  or output_refs <> '[]'::jsonb
                  or snapshot <> '{}'::jsonb
                then now()
                else updated_at
              end
        where project_id = $1
          and stage_key = any($2::text[])`,
      [projectId, downstreamStageKeys],
    );

    const finalProject = (await selectRows(client, `select id, brand_name, project_name, current_stage, status from projects where id = $1`, [projectId]))[0];
    const finalCounts = {
      storyboardScenes: Number((await client.query(`select count(*)::int as count from storyboard_scenes where project_id = $1`, [projectId])).rows[0].count),
      storyboardShots: Number((await client.query(`select count(*)::int as count from storyboard_shots where project_id = $1`, [projectId])).rows[0].count),
      productionEntities: Number((await client.query(`select count(*)::int as count from production_entities where project_id = $1`, [projectId])).rows[0].count),
      productionReferenceSets: Number((await client.query(`select count(*)::int as count from production_reference_sets where project_id = $1`, [projectId])).rows[0].count),
      scriptPackageReviews: Number(
        (await client.query(`select count(*)::int as count from client_review_tasks where project_id = $1 and review_type = 'script_package' and target_scope_id = $2`, [projectId, packageId])).rows[0].count,
      ),
      formatArtifacts: Number(
        (
          await client.query(
            `select count(*)::int as count
               from artifacts
              where project_id = $1
                and kind = 'script_direction_package'
                and data_json ->> 'packageId' = $2
                and data_json ->> 'operation' in ('script_format_standardization', 'script_format_check')`,
            [projectId, packageId],
          )
        ).rows[0].count,
      ),
    };

    await client.query("commit");

    console.log(JSON.stringify({
      ok: true,
      backupPath,
      projectId,
      keepStandardizedScript,
      backupSummary: {
        storyboardScenes: backup.storyboardScenes.length,
        storyboardShots: backup.storyboardShots.length,
        productionEntities: backup.productionEntities.length,
        productionReferenceSets: backup.productionReferenceSets.length,
        scriptReviewTasks: backup.scriptReviewTasks.length,
        formatArtifacts: backup.formatArtifacts.length,
      },
      deleted,
      final: {
        project: finalProject,
        scriptPackage: {
          id: updatedPackage?.id,
          status: updatedPackage?.status,
          standardizedScriptReady: Boolean(String(updatedPackage?.standardized_script ?? "").trim()),
        },
        counts: finalCounts,
      },
    }, null, 2));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "回退脚本执行失败。");
  process.exit(1);
});
