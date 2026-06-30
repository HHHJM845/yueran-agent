export function normalizeStoryboardSplitResponse(value: unknown) {
  const record = asRecord(value);
  const rawScenes =
    asArray(record.scenes) ??
    asArray(record.storyboardScenes) ??
    asArray(record.storyboard_scenes) ??
    asArray(record.分镜场次) ??
    asArray(record.场次) ??
    [];

  return {
    scenes: rawScenes.map((scene, sceneIndex) => {
      const sceneRecord = asRecord(scene);
      const rawShots =
        asArray(sceneRecord.shots) ??
        asArray(sceneRecord.storyboardShots) ??
        asArray(sceneRecord.storyboard_shots) ??
        asArray(sceneRecord.分镜) ??
        asArray(sceneRecord.镜头) ??
        [];
      return {
        sceneNumber: normalizeSceneNumber(
          firstValue(sceneRecord.sceneNumber, sceneRecord.scene_number, sceneRecord.number, sceneRecord.场次编号),
          sceneIndex
        ),
        title: firstString(sceneRecord.title, sceneRecord.name, sceneRecord.标题, sceneRecord.场次标题) ?? `场次 ${sceneIndex + 1}`,
        description: firstString(sceneRecord.description, sceneRecord.desc, sceneRecord.场次描述, sceneRecord.描述) ?? "",
        shots: rawShots.map((shot, shotIndex) => {
          const shotRecord = asRecord(shot);
          const shotNumber =
            firstString(shotRecord.shotNumber, shotRecord.shot_number, shotRecord.number, shotRecord.分镜编号, shotRecord.镜号) ??
            `${sceneIndex + 1}-${shotIndex + 1}`;
          const visualDescription =
            firstString(
              shotRecord.visualDescription,
              shotRecord.visual_description,
              shotRecord.picture,
              shotRecord.frame,
              shotRecord.画面内容,
              shotRecord.画面描述,
              shotRecord.description,
              shotRecord.desc
            ) ?? `分镜 ${shotNumber}`;
          return {
            shotNumber,
            visualDescription,
            shotSize: firstString(shotRecord.shotSize, shotRecord.shot_size, shotRecord.景别) ?? "",
            actionExpression:
              firstString(shotRecord.actionExpression, shotRecord.action_expression, shotRecord.action, shotRecord.动作与表情) ?? "",
            cameraMovement:
              firstString(shotRecord.cameraMovement, shotRecord.camera_movement, shotRecord.camera, shotRecord.机位与运镜) ?? "",
            durationSeconds: normalizeDuration(firstValue(shotRecord.durationSeconds, shotRecord.duration_seconds, shotRecord.duration, shotRecord.时长)),
            soundTransition:
              firstString(shotRecord.soundTransition, shotRecord.sound_transition, shotRecord.sound, shotRecord.声音与转场) ?? "",
            notes: firstString(shotRecord.notes, shotRecord.remark, shotRecord.备注) ?? "",
            characterRefs: normalizeArray(shotRecord.characterRefs, shotRecord.character_refs, shotRecord.characters, shotRecord.涉及人物),
            sceneRefs: normalizeArray(shotRecord.sceneRefs, shotRecord.scene_refs, shotRecord.scenes, shotRecord.涉及场景),
            imagePrompt: firstString(shotRecord.imagePrompt, shotRecord.image_prompt, shotRecord.prompt, shotRecord.图片Prompt) ?? "",
            videoPrompt: firstString(shotRecord.videoPrompt, shotRecord.video_prompt, shotRecord.video, shotRecord.视频Prompt) ?? "",
          };
        }),
      };
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function firstValue(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function firstString(...values: unknown[]) {
  const value = firstValue(...values);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeDuration(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]+/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function normalizeSceneNumber(value: unknown, sceneIndex: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(/[第\s]/g, "")
      .replace(/[集场幕]/g, "");
    const episodeSceneMatch = normalized.match(/^(\d+)\s*[-—–_]\s*(\d+)$/);
    if (episodeSceneMatch) {
      return sceneIndex + 1;
    }
    const firstNumber = normalized.match(/\d+/)?.[0];
    if (firstNumber) {
      const parsed = Number(firstNumber);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
  }
  return sceneIndex + 1;
}

function normalizeArray(...values: unknown[]) {
  const value = firstValue(...values);
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}
