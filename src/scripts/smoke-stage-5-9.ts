import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { query } = await import("@/lib/db");
  const { createProject } = await import("@/server/repositories/projects");
  const { saveScriptDirectionPackage, splitScriptIntoStoryboard } = await import("@/server/use-cases/script-storyboard");
  const {
    createStoryboardDraft,
    createStoryboardImageRecord,
    selectStoryboardImage,
  } = await import("@/server/repositories/story-production");
  const { createReviewForStoryboardScene, submitClientReviewByToken } = await import("@/server/use-cases/client-review");
  const {
    enqueueStoryboardImageGeneration,
    enqueueStoryboardVideoGeneration,
    runStoryboardImageGenerationJob,
    runStoryboardVideoGenerationJob,
  } = await import("@/server/use-cases/storyboard-media");
  const { env } = await import("@/lib/env");

  const marker = `smoke-${Date.now()}`;
  const runRealAiSmoke = process.env.STAGE_5_9_REAL_AI_SMOKE === "1";
  let realStoryboardSplitStatus: "not_run" | "succeeded" | "fallback" = "not_run";
  const actor = {
    id: randomUUID(),
    name: "Smoke Admin",
    email: `${marker}@example.com`,
    role: "admin" as const,
    isActive: true,
  };
  let projectId: string | null = null;

  try {
    await query(`insert into users (id, name, email, role, is_active) values ($1, $2, $3, 'admin', true)`, [
      actor.id,
      actor.name,
      actor.email,
    ]);
    const project = await createProject(
      { brandName: `SmokeBrand-${marker}`, projectName: "P5 链路冒烟", ownerName: "Smoke Admin" },
      actor
    );
    projectId = project.id;
    const smokeProjectId = project.id;

    const savedPackage = await saveScriptDirectionPackage({
      projectId: smokeProjectId,
      title: "高能开场脚本方向",
      concept: "以产品穿越球场声浪为核心视觉钩子。",
      fullScript: "第一场：球场灯光亮起，主角穿过通道。第二场：产品在草坪中央完成高光展示。",
      actorId: actor.id,
      characterReferences: [
        { title: "主角写实", styleLabel: "写实运动员", prompt: "年轻运动员，坚定表情" },
        { title: "主角潮流", styleLabel: "潮流街头", prompt: "街头运动风" },
        { title: "主角未来", styleLabel: "未来科技", prompt: "未来感训练服" },
      ],
      sceneReferences: [
        { title: "球员通道", styleLabel: "暗部强光", prompt: "球员通道，背光" },
        { title: "中心草坪", styleLabel: "大场面", prompt: "世界杯球场中心" },
      ],
    });
    logRealSmoke(runRealAiSmoke, "脚本方向包已保存");

    const createFallbackDraft = () =>
      createStoryboardDraft({
          projectId: smokeProjectId,
          packageId: savedPackage.package.id,
          actorId: actor.id,
          scenes: [
            {
              sceneNumber: 1,
              title: "通道登场",
              description: "人物从暗部进入球场光线。",
              shots: [
                {
                  shotNumber: "1-1",
                  visualDescription: "主角站在球员通道尽头，强光从背后打入。",
                  shotSize: "中景",
                  imagePrompt: "cinematic sports tunnel",
                  videoPrompt: "slow push in, stadium light blooms, cinematic sports commercial",
                },
                {
                  shotNumber: "1-2",
                  visualDescription: "主角抬头看向球场，观众声浪增强。",
                  shotSize: "特写",
                  imagePrompt: "close up determined face",
                  videoPrompt: "subtle head lift, crowd energy rising, shallow depth of field",
                },
              ],
            },
          ],
        });
    const draft = runRealAiSmoke
      ? await splitScriptIntoStoryboard({ projectId: smokeProjectId, packageId: savedPackage.package.id, actorId: actor.id })
          .then((result) => {
            realStoryboardSplitStatus = "succeeded";
            return result;
          })
          .catch(async (error) => {
            realStoryboardSplitStatus = "fallback";
            const message = error instanceof Error ? error.message : "真实文字分镜拆分失败。";
            console.warn(`真实文字分镜拆分未完成，继续用人工草稿验证模块二/三：${message}`);
            return createFallbackDraft();
          })
      : await createFallbackDraft();
    logRealSmoke(runRealAiSmoke, `文字分镜已准备：${draft.shots.length} 条`);
    const [shot1] = draft.shots;
    if (!shot1) throw new Error("文字分镜拆分结果为空，无法继续 5-9 smoke。");
    let realImageJobId: string | null = null;
    let realVideoJobId: string | null = null;
    let realVideoStatus: "not_run" | "succeeded" | "blocked" = "not_run";

    const image1 = runRealAiSmoke
      ? await generateRealStoryboardImage({
          projectId: smokeProjectId,
          shotId: shot1.id,
          actorId: actor.id,
          enqueueStoryboardImageGeneration,
          runStoryboardImageGenerationJob,
        }).then((result) => {
          realImageJobId = result.jobId;
          return result.image;
        })
      : await createStoryboardImageRecord({
          projectId: smokeProjectId,
          sceneId: draft.scenes[0].id,
          shotId: shot1.id,
          prompt: "test image prompt 1",
          provider: "smoke",
          modelName: "smoke-model",
          actorId: actor.id,
        });
    logRealSmoke(runRealAiSmoke, "首条分镜图片已准备");
    if (!runRealAiSmoke) {
      await query(`update storyboard_images set generation_status = 'succeeded', oss_url = $2, oss_key = $3 where id = $1`, [
        image1.id,
        "https://example.com/shot1.png",
        "smoke/shot1.png",
      ]);
    }
    await selectStoryboardImage({ projectId: smokeProjectId, imageId: image1.id, actorId: actor.id });

    const remainingShots = draft.shots.slice(1);
    const fallbackImages = [];
    for (const [index, shot] of remainingShots.entries()) {
      const fallbackImage = await createStoryboardImageRecord({
        projectId: smokeProjectId,
        sceneId: shot.sceneId,
        shotId: shot.id,
        prompt: `test image prompt ${index + 2}`,
        provider: "smoke",
        modelName: "smoke-model",
        actorId: actor.id,
      });
      await query(`update storyboard_images set generation_status = 'succeeded', oss_url = $2, oss_key = $3 where id = $1`, [
        fallbackImage.id,
        `https://example.com/shot${index + 2}.png`,
        `smoke/shot${index + 2}.png`,
      ]);
      await selectStoryboardImage({ projectId: smokeProjectId, imageId: fallbackImage.id, actorId: actor.id });
      fallbackImages.push(fallbackImage);
    }
    logRealSmoke(runRealAiSmoke, "本场所有分镜图片已确认");

    if (runRealAiSmoke) {
      const videoResult = await generateRealStoryboardVideo({
        projectId: smokeProjectId,
        shotId: shot1.id,
        actorId: actor.id,
        enqueueStoryboardVideoGeneration,
        runStoryboardVideoGenerationJob,
      });
      realVideoJobId = videoResult.jobId;
      realVideoStatus = videoResult.succeeded ? "succeeded" : "blocked";
      logRealSmoke(runRealAiSmoke, `视频生成验证完成：${realVideoStatus}`);
    }

    const reviewScene = draft.scenes[0];
    if (!reviewScene) throw new Error("文字分镜拆分结果没有场次，无法创建场次审核。");
    const reviewShots = draft.shots.filter((shot) => shot.sceneId === reviewScene.id);
    const review = await createReviewForStoryboardScene({
      projectId: smokeProjectId,
      sceneId: reviewScene.id,
      actorId: actor.id,
      origin: "http://localhost:3000",
    });
    logRealSmoke(runRealAiSmoke, "场次审核链接已创建");
    const token = review.reviewUrl.split("/").pop();
    if (!token) throw new Error("审核链接未生成 token");

    const submitted = await submitClientReviewByToken(token, {
      verificationCode: review.verificationCode,
      decision: "rejected",
      reviewerName: "甲方 Smoke",
      feedback: "整场节奏还需要更统一。",
      items: reviewShots.map((shot, index) => ({
        itemId: shot.id,
        decision: index === 0 ? ("approved" as const) : ("rejected" as const),
        score: index === 0 ? 5 : 2,
        feedback: index === 0 ? "这一镜可以保留。" : "这一镜需要更有冲击力。",
      })),
    });
    const scene = await query<{ status: string }>(`select status from storyboard_scenes where id = $1`, [reviewScene.id]);
    const decisions = await query<{ item_id: string; decision: string; score: number | null; feedback: string }>(
      `select item_id, decision, score, feedback
       from client_review_items
       where review_task_id = $1
       order by created_at asc`,
      [review.task.id]
    );
    const decisionsByShot = new Map(decisions.rows.map((row) => [row.item_id, row]));

    const passed =
      scene.rows[0]?.status === "client_rejected" &&
      submitted.task.status === "rejected" &&
      decisionsByShot.size === reviewShots.length &&
      reviewShots.every((shot, index) => {
        const decision = decisionsByShot.get(shot.id);
        return decision?.decision === (index === 0 ? "approved" : "rejected") && decision.score === (index === 0 ? 5 : 2);
      });

    if (!passed) {
      throw new Error(`5-9 冒烟结果不符合预期：${JSON.stringify({ scene: scene.rows[0], decisions: decisions.rows })}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          projectId: smokeProjectId,
          packageId: savedPackage.package.id,
          realAiSmoke: runRealAiSmoke,
          videoModel: env.ARK_VIDEO_GENERATION_MODEL,
          realStoryboardSplitStatus,
          realImageJobId,
          realVideoJobId,
          realVideoStatus,
          sceneStatus: scene.rows[0].status,
          reviewStatus: submitted.task.status,
          decisions: decisions.rows,
        },
        null,
        2
      )
    );
  } finally {
    await cleanupSmokeData({
      query,
      marker,
      projectId,
      actorId: actor.id,
    });
  }
}

void main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "5-9 smoke failed");
    process.exit(1);
  });

async function generateRealStoryboardImage(input: {
  projectId: string;
  shotId: string;
  actorId: string;
  enqueueStoryboardImageGeneration: typeof import("@/server/use-cases/storyboard-media").enqueueStoryboardImageGeneration;
  runStoryboardImageGenerationJob: typeof import("@/server/use-cases/storyboard-media").runStoryboardImageGenerationJob;
}) {
  const enqueued = await input.enqueueStoryboardImageGeneration({
    projectId: input.projectId,
    shotId: input.shotId,
    requestedBy: input.actorId,
  });
  const result = await input.runStoryboardImageGenerationJob(enqueued.jobId);
  return { jobId: enqueued.jobId, image: result.storyboardImage };
}

async function generateRealStoryboardVideo(input: {
  projectId: string;
  shotId: string;
  actorId: string;
  enqueueStoryboardVideoGeneration: typeof import("@/server/use-cases/storyboard-media").enqueueStoryboardVideoGeneration;
  runStoryboardVideoGenerationJob: typeof import("@/server/use-cases/storyboard-media").runStoryboardVideoGenerationJob;
}) {
  const enqueued = await input.enqueueStoryboardVideoGeneration({
    projectId: input.projectId,
    shotId: input.shotId,
    requestedBy: input.actorId,
  });
  try {
    await input.runStoryboardVideoGenerationJob(enqueued.jobId);
    return { jobId: enqueued.jobId, succeeded: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "真实视频 smoke 失败。";
    console.warn(`真实视频 smoke 未完成：${message}`);
    return { jobId: enqueued.jobId, succeeded: false };
  }
}

async function cleanupSmokeData(input: {
  query: typeof import("@/lib/db").query;
  marker: string;
  projectId: string | null;
  actorId: string;
}) {
  const projectBrand = `SmokeBrand-${input.marker}`;

  await cleanupStep(
    input.query,
    "清理 smoke 审计日志",
    `delete from audit_logs
     where actor_id = $1
        or project_id in (
          select id from projects
          where brand_name = $2
             or ($3::uuid is not null and id = $3::uuid)
        )`,
    [input.actorId, projectBrand, input.projectId]
  );

  const projectsDeleted = await cleanupStep(
    input.query,
    "清理 smoke 项目",
    `delete from projects
     where brand_name = $1
        or ($2::uuid is not null and id = $2::uuid)`,
    [projectBrand, input.projectId]
  );

  if (!projectsDeleted) {
    console.warn("smoke 项目未能清理，已跳过临时用户删除，避免触发 owner 外键错误。");
    return;
  }

  await cleanupStep(input.query, "清理 smoke 会话", `delete from user_sessions where user_id = $1`, [input.actorId]);
  await cleanupStep(input.query, "清理 smoke 成员关系", `delete from project_members where user_id = $1`, [input.actorId]);
  await cleanupStep(input.query, "清理 smoke 用户审计", `delete from audit_logs where actor_id = $1`, [input.actorId]);
  await cleanupStep(input.query, "清理 smoke 临时用户", `delete from users where id = $1 or email = $2`, [
    input.actorId,
    `${input.marker}@example.com`,
  ]);
}

async function cleanupStep(
  query: typeof import("@/lib/db").query,
  label: string,
  sql: string,
  params: unknown[],
  attempts = 3
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await query(sql, params);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      console.warn(`${label}失败（第 ${attempt}/${attempts} 次）：${message}`);
      if (attempt < attempts) await delay(1200 * attempt);
    }
  }
  return false;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logRealSmoke(enabled: boolean, message: string) {
  if (enabled) console.warn(`[stage-5-9-real-smoke] ${message}`);
}
