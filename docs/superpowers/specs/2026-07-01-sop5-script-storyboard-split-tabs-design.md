# SOP5 Script And Storyboard Split Tabs Design

## Goal

Refactor SOP 5 from one stacked "script, entity, storyboard confirmation" workspace into two focused sub-tabs:

1. 脚本设定（完整剧本）
2. 文字分镜拆解

The workspace shows only the current task area, while keeping a small read-only progress map at the bottom for history and backtracking context.

## Scope

This design changes SOP 5 only. It does not redesign SOP 4 contract signing, SOP 6 storyboard image generation, or the cross-project knowledge base.

The first version must use:

- The finalized creative proposal and selected/final creative direction.
- Current project assets and project-local outputs, including Brief, uploaded customer materials, asset analyses, selected proposal rounds, contract/delivery constraints, and existing project artifacts.

The first version must not use:

- Cross-project knowledge base retrieval.
- External knowledge-base plugins.
- Long-term knowledge writeback from human script comments.

Human comments are persisted only as SOP 5 script revision conversation records for this project.

## Current Problems

The existing SOP 5 workspace exposes a mechanical flow:

- Paste an externally written script.
- Save and run standard format check.
- Show standard format issues.
- Send "甲方完整剧本确认".
- Then manually trigger storyboard splitting.

This conflicts with the desired production workflow. The AI should generate the first complete plain-language script after contract signing, then the human should iterate naturally through conversation, and only then produce a standardized industry-format script.

## Product Flow

### Entry Trigger

When SOP 4 contract signing is confirmed and the project enters `script_storyboard_confirmation`, SOP 5 should be ready to generate or show a plain-language script.

If no SOP 5 script package exists, the script setup tab exposes an automatic generation state:

- It gathers finalized creative proposal data and current project-local context.
- It calls the text model to generate a complete "大白话剧本".
- It saves the generated version as the current script package.
- The user sees a natural-language loading/success/error message.

If generation fails, the stage remains in SOP 5 with a recoverable error and a retry action.

### Sub-Tab 1: 脚本设定（完整剧本）

The tab contains:

- Current plain-language script at the top.
- A continuous conversation area below the script.
- Text input for revision instructions.
- UI affordance for voice input, allowed as a front-end control placeholder when browser speech support is unavailable, but no fake transcription success.
- A "确认提交" action that generates the standardized script from the current plain-language script.
- A standardized script panel after confirmation.
- A "修改" action on the standardized script panel for small manual edits.
- Bottom actions:
  - 确认修改
  - 发送给甲方

The tab must not show:

- "人工在外部写好剧本复制粘贴进来"
- "点击格式检查"
- "标准格式检查"
- "甲方完整剧本确认"
- Blocking format validation panels

The UI may still use "标准化剧本" or "生成标准化剧本" where it describes the new post-confirmation AI output. It must not recreate the old paste-then-check mechanical sequence.

The AI-generated standardized script is treated as structurally valid by default. The UI should not expose format self-check results as a user task.

### Revision Conversation

Each human instruction is saved with:

- Project ID
- Script package ID
- Role: user or assistant
- Content
- Source: text or voice
- Created by
- Created at

Each AI revision updates the current plain-language script version and records the assistant response in the same conversation stream.

The conversation supports multiple rounds and vertical scrolling.

### Standardized Script

The standardized script is generated from the confirmed current plain-language script. It should follow the Asian industry script template style using scene headings and symbols such as `△` and `*` where appropriate.

Manual edits are allowed for punctuation, sentence additions, deletions, and small wording changes. Manual edits persist as a new standardized script version.

### Sub-Tab 2: 文字分镜拆解

The tab is logically continuous with script setup but has an independent surface and output.

It reads the confirmed standardized script and automatically splits it into storyboard scenes and shots.

The user can:

- View shots grouped by scene.
- Drag to reorder shots.
- Move shots up/down as an accessible fallback.
- Add shots.
- Delete shots when no downstream image/video assets have been generated.
- Save the sequence.

The system also extracts all characters and scenes from the script/storyboard. The user can:

- Confirm main characters and main scenes.
- Add missing characters/scenes.
- Ignore unnecessary extracted entries.

Ignored entities do not block progression.

When storyboard splitting and entity cleanup are valid, the stage can flow directly to `storyboard_image_canvas`. No extra check or confirmation panel is needed.

## Data Model

Reuse existing tables:

- `script_direction_packages`
- `storyboard_scenes`
- `storyboard_shots`
- `production_entities`
- `production_reference_sets`
- `artifacts`
- `project_stage_states`

Add only the minimum database support needed for the new SOP 5 flow:

- Script package fields for plain-language script and standardized script separation.
- Script package status values or metadata for:
  - plain script generated
  - plain script confirmed
  - standardized script generated
  - standardized script sent to client
- A project-local script conversation table or project artifact kind for revision messages.

Preferred persistence shape:

- Keep generated script bodies on `script_direction_packages`.
- Store revision conversation records in a dedicated table if the implementation needs querying/pagination; otherwise use typed project artifacts if that matches existing repository patterns cleanly.
- Keep storyboard scenes/shots in existing storyboard tables.
- Keep extracted character/scene candidates in `production_entities` with `inclusion_status = active | ignored`.

SQL migration and `src/server/database/schema.sql` must stay in sync.

## API Contract

Add or update routes around existing SOP 5 endpoints:

- Generate plain-language script from finalized proposal and current project context.
- Append a script revision message and generate an updated script version.
- Generate standardized script from the current plain-language script.
- Save manual standardized-script edits.
- Send standardized script to client review or Feishu delivery, depending on existing project pattern.
- Split standardized script into storyboard scenes/shots.
- Save storyboard sequence edits.
- Confirm/ignore/add production entities.
- Advance to `storyboard_image_canvas` after storyboard sequence and active entity list are ready.

Existing "check format" route may remain for compatibility, but the SOP 5 workspace must not call or promote it.

## UI Direction

This is an internal production workspace, so the design direction is "quiet operational studio":

- Dense but readable.
- No hero treatment.
- No nested cards.
- Current task first.
- History/progress reduced to a small bottom map.
- Natural language loading, success, empty, blocked, and error states.

The two sub-tabs should be compact segmented controls inside SOP 5, not new global stages.

## Progress Map

The bottom progress map is read-only and small:

1. 合同签约
2. 大白话剧本
3. 对话修订
4. 标准剧本
5. 文字分镜
6. 人物场景
7. 分镜图生成

It may show current/completed/blocked states, but cannot trigger rollback or mutate project state.

## Baseline And DoD

Implementation must use TDD:

- Write failing tests first.
- Verify the tests fail for the expected reason.
- Implement the smallest passing change.
- Run related tests.

Required verification before completion:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Relevant SOP 5 tests
- `npm run test:baseline`
- Browser inspection for the SOP 5 UI path if a runnable authenticated test path is available

The baseline command must include SOP 5 protection for:

- Two sub-tabs are present.
- Old paste/check/client-confirmation language is absent.
- Script setup uses auto-generated plain-language script workflow.
- Storyboard split is an independent sub-tab.
- Bottom progress map remains read-only and compact.
- Backend route/schema contracts for SOP 5 stay aligned.
