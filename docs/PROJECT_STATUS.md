# AUGC Flow 项目进度交接

更新时间：2026-06-25

## 当前目标

内部 AIGC 视频项目协同工作台，一期前置商业流程已按最新口径聚合为两个功能模块：

1. Brief 到完整项目提案
2. 项目报价合同完成

实现层仍保留原有阶段键，用于数据库状态机、历史记录和精细回溯，不做破坏性迁移。

5-9 步已按最新需求合并为三大模块并开始真实实现：脚本创意与文字分镜确认、分镜图片自由画布、AI 视频自由画布。详见 `docs/STAGE_5_9_PID.md`。

## 已完成能力

- Next.js / React / TypeScript 工程底座
- 基础 shadcn 风格工作台 UI
- 首个管理员 bootstrap、登录、会话、角色权限基础
- 项目创建、项目列表、左侧项目导航、右侧工作台
- 功能模块导航 + 底层阶段导航：前四个实现阶段聚合为两个业务模块，5-9 聚合为三个生产模块；未进入模块置灰，历史阶段可回溯但不改变真实当前阶段
- Neon Postgres 接入
- 阿里云 OSS 上传签名、文件上传、资产入库
- PDF / Word / 文本 / 图片 / 视频资料解析任务入口
- 火山方舟豆包 OpenAI SDK 封装
- 需求结构化任务：`doubao-seed-2-1-pro-260628`
- 样片/资料理解任务：`doubao-seed-2-0-lite-260215`
- 评分规则配置后台
- 资料解析结果与标签评分产物
- Top 5 创意方向生成任务
- Top 5 创意方向持久化表：`creative_directions`
- 创意方向选择/多选
- 创意方向人工改写保存
- 创意方向 artifact 快照：`creative_direction`
- 创意方向深化表：`creative_expansions`
- 创意方向深化任务 use-case / API / worker handler 已接入
- 创意方向深化真实 worker smoke 已通过：写入 5 条 `creative_expansions`，并创建 `creative_expansion` artifact
- 氛围图生成表：`generated_images`
- 氛围图生成任务 use-case / API / worker handler 已接入
- OpenAI 图片 provider：`gpt-image-2-all`
- 氛围图生成真实 worker smoke 已通过：图片保存到 OSS，写入 `generated_images`，并创建 `generated_image` artifact
- 提案编辑表：`proposals`
- 文档快照表：`document_snapshots`
- 提案保存 API / repository / use-case 已接入
- 提案每次保存会递增版本、创建 `document_snapshots` 快照，并创建 `proposal` artifact
- 报价编辑表：`quotes`
- 报价保存 API / repository / use-case 已接入
- 报价每次保存会递增版本、创建 `document_snapshots` 快照，并创建 `quote` artifact
- 合同编辑表：`contracts`
- 合同模板填充、正文编辑、状态保存 API / repository / use-case 已接入
- 合同每次保存会递增版本、创建 `document_snapshots` 快照，并创建 `contract` artifact
- 工作台已接入合同编辑卡片，商务/管理员可编辑，创意团队只读
- 合同导出表：`document_exports`
- 合同 PDF / Word 导出任务已接入，基于合同快照生成真实文件、上传 OSS，并创建 `document_export` artifact
- 工作台已接入合同导出按钮和历史导出记录
- 飞书交付表：`feishu_deliveries`
- 飞书交付任务 use-case / API / worker handler 已接入
- 飞书 OpenAPI provider 已接入：tenant token、Docx 文档创建、文档正文写入、个人/群聊消息发送
- 工作台已接入飞书交付表单，可选择提案/报价/合同快照，发送给个人 open_id 或群聊 chat_id，并展示交付历史
- 飞书交付完成后会回写文档 token、文档链接、消息 ID、发送时间，并创建 `feishu_delivery_record` artifact
- 飞书交付加固：如果文档创建成功但消息发送失败，交付记录也会保留飞书文档链接，方便人工补发
- 项目阶段状态机已接入真实持久化：`project_stage_states` 会记录阶段状态、失败原因、输入输出引用和快照，工作台模块导航优先显示数据库状态
- 现有项目已完成阶段状态回填，新项目创建时会初始化 12 个阶段
- 需求结构化、资料解析、Top 5 创意方向、创意深化、氛围图、提案、报价、合同、飞书交付已接入阶段状态更新
- 飞书文档链接正文解析已接入资产解析链路：飞书链接可登记为资产，后台读取正文后走豆包文本分析、标签评分和 artifact 落库
- 素材库语义检索一期已接入：`doubao-embedding-vision-251215` 通过火山方舟 `/embeddings/multimodal` 生成向量，保存 `material_embeddings`，检索结果保存 `material_search_results`
- Top 5 创意方向生成会先对已解析资料做语义检索，并把 Top K 素材结果注入创意方向 prompt
- 三类角色仪表盘深化已接入真实聚合 API：`GET /api/dashboard`
- 商务仪表盘已按真实项目、报价合同、飞书交付状态聚合待办
- 创意仪表盘已按资料解析、Top 5、方向深化、氛围图状态聚合待办
- 管理仪表盘已按阻塞项目、异常任务、评分规则/成员治理聚合待办
- 顶部 RoleDashboard 已从静态文案改为真实指标卡、待办分区和最近项目列表，点击待办可切换到对应项目
- 后台 worker、任务事件流、失败重试、自然语言错误
- P0 商务文档 Agent 草稿已接入真实异步任务：一次生成提案、报价、合同草稿，全部成功后复用现有保存 use-case 创建版本、快照与 artifact
- 商务文档草稿使用火山方舟 OpenAI SDK Responses API，并关闭深度思考以稳定输出严格 JSON
- 飞书失败交付已支持一键补发、替换个人 open_id 或群 chat_id，并复用上一次已创建成功的飞书文档
- 提案与合同正文已升级为轻量富文本编辑体验，支持标题、重点、项目符号、编号，保存内容兼容现有 PDF/Word 和飞书链路
- 合同工作区已支持选择项目内甲方合同/报价文档资产，并持久化到 `client_contract_asset_id`
- 氛围图人工审核已接入真实持久化：`pending / confirmed / discarded`，创意团队和管理员可填写审核备注、确认采用或废弃，商务团队只读
- 氛围图审核仅允许操作已生成成功的图片，状态更新与 `audit_logs` 审计记录在同一事务中提交
- 评分规则已接入递增版本治理：当前规则保存 `version`，不可覆盖的历史快照保存到 `scoring_rule_versions`
- 评分规则历史版本 API 与管理端展开查看界面已完成，旧规则执行迁移后自动回填 v1
- 评分规则新增/修改会在同一事务内保存当前版本、历史快照和审计日志
- AI 调用计量表：`ai_task_logs`
- 统一 provider telemetry 已接入 Ark 文本 JSON、Ark Responses、Ark 多模态理解、Ark embedding 和 OpenAI 图片生成
- 火山方舟视频生成已按官方异步任务 API 接入：创建任务 `POST /api/v3/contents/generations/tasks`，查询任务 `GET /api/v3/contents/generations/tasks/{id}`，成功后读取 `content.video_url` 并转存 OSS
- AI 调用日志会记录 project/job/callId、provider/model、operation、状态、provider response id、token、耗时、输入/输出字符数、图片数量、embedding 维度和错误摘要
- AI telemetry 写入为旁路保护：日志写入失败会保留服务端诊断，不阻断主 AI 任务成功路径
- 创意仪表盘待处理氛围图统计已补齐：同时覆盖“未生成成功图”和“成功图待人工确认”
- 关键操作审计已扩展：资产登记/解析、需求结构化、创意方向生成/选择/改写、故事大纲、氛围图生成、提案/报价/合同保存、合同导出、飞书交付、受控文件访问都会写入 `audit_logs`
- `audit_logs` 已增加 `project_id` 和 created/project/actor/action 索引，便于管理员按项目与动作追溯
- 管理员治理 API：`GET /api/admin/governance`，聚合 `ai_task_logs` 使用统计和最近审计记录
- 工作台管理员治理卡已接入真实治理 API，展示 AI 调用计量、provider 分布和最近审计摘要
- 敏感资产和合同导出已接入受控访问 API：资产 `POST /api/projects/[projectId]/assets/[assetId]/access`，导出文件 `POST /api/projects/[projectId]/document-exports/[exportId]/access`
- 工作台资产列表、甲方合同绑定资产、合同导出历史已从直连 OSS 链接改为受控打开，访问会写审计日志
- 受控访问已细分 preview/download：资产和合同导出均支持独立预览/下载路由，OSS 临时读链接会按场景签入 `Content-Disposition` 与 `Content-Type` 覆写参数
- 项目基础信息编辑已接入真实持久化：`PATCH /api/projects/[projectId]` 可更新品牌名、项目名、负责人显示名、截止时间；管理员可编辑全部项目，商务仅项目 owner 可编辑，创意只读
- 项目创建与基础信息更新已写入 `audit_logs`；项目更新会同步当前阶段 ownerName 快照，刷新后可从数据库恢复
- 项目级飞书常用接收对象已接入：`project_feishu_receivers` 保存个人 open_id / 群 chat_id、显示名、主接收对象、最近发送与失败信息
- 飞书交付表单已支持选择项目内常用接收对象，也可手动输入并保存为常用；交付历史仍保留发送时 receiver 快照，并通过 `receiver_ref_id` 弱关联常用接收对象
- 飞书交付成功/失败后会回写常用接收对象最近交付、发送时间或失败原因；联系人/群聊保存、更新、停用会写审计且不在审计里记录完整 receiver_id
- 报价/合同审核流转已接入真实状态闭环：支持提交审核、管理员确认、管理员驳回修改、标记已发送、标记已签署、终止
- 报价/合同审核动作会更新 `quotes` / `contracts` 状态、写入 `audit_logs`、同步报价合同阶段状态；驳回进入 `needs_revision`，终止进入 `blocked`，签署完成后进入后续交付归档占位
- 甲方外部审核模块已横切复用：`POST /api/projects/[projectId]/client-reviews` 可为 Brief、完整项目提案、报价、合同、脚本方向包生成安全链接 + 验证码；外部提交后回写对应业务对象状态、阶段状态和审核明细
- 外部审核页面已支持文本/结构化审核和分镜图片审核；甲方无需登录，通过链接 + 验证码/密钥提交通过或打回
- 前端右侧 AI 进度/日志栏已移除；任务状态、事件流、AI 调用计量和审计信息保留在后端 `jobs`、`job_events`、`ai_task_logs`、`audit_logs`，前端只展示业务状态和自然语言反馈

## 主要模型约定

当前统一使用 OpenAI SDK 兼容调用方式：

- 文本结构化 / 创意生成：`doubao-seed-2-1-pro-260628`
- 图片/视频理解：`doubao-seed-2-0-lite-260215`
- 视频生成：`doubao-seedance-1-5-pro-251215`
- 素材库语义检索：`doubao-embedding-vision-251215`
- 氛围图生成：`gpt-image-2-all`，通过 `OPENAI_BASE_URL=https://new.suxi.ai`

模型名必须从环境变量读取，不要硬编码到业务逻辑里。

## 当前数据库状态

- 数据库里已有一个测试项目：`耐克 / 世界杯`
- 已生成过真实 Top 5 创意方向
- 已生成过真实故事大纲/梗概和真实氛围图
- 已保存过真实提案 v1/v2，并生成历史快照
- 已保存过真实报价 v1/v2，并生成历史快照
- 已保存过真实合同 v1/v2，并生成历史快照
- 已导出过真实合同 PDF / Word，并保存到 OSS
- 已创建正式管理员账号：`823760642@163.com` / `JM` / `admin`
- `.env.local` 本地存在真实密钥，不要提交或打印

## 最近一次正在推进的功能

正在推进：前置商业模块和 5-9 生产模块的状态机与甲方审核横切能力打通。当前已完成模块化导航、Brief/提案/报价/合同/脚本方向审核链接生成与回写、前端右侧日志栏移除。

刚完成：管理员后台创建系统用户功能；技术不可行 blocked 管理闭环、创意方向驳回 / 修改 / 重新提交状态流、审计查询独立分页筛选页面。

已完成代码：

- `src/server/repositories/creative-expansions.ts`
- `src/server/use-cases/generate-creative-expansions.ts`
- `src/server/repositories/generated-images.ts`
- `src/server/use-cases/generate-atmosphere-image.ts`
- `src/server/use-cases/generate-atmosphere-image.test.mjs`
- `src/server/providers/openai-image.ts`
- `src/server/repositories/proposals.ts`
- `src/server/repositories/quotes.ts`
- `src/server/repositories/contracts.ts`
- `src/server/repositories/document-exports.ts`
- `src/server/repositories/feishu-deliveries.ts`
- `src/server/repositories/project-stages.ts`
- `src/server/repositories/material-search.ts`
- `src/server/repositories/dashboard.ts`
- `src/server/use-cases/generate-document-drafts.ts`
- `src/server/use-cases/generate-document-drafts.test.mjs`
- `src/app/api/projects/[projectId]/drafts/generate/route.ts`
- `src/app/api/projects/[projectId]/feishu-delivery/[deliveryId]/retry/route.ts`
- `src/server/use-cases/save-proposal.ts`
- `src/server/use-cases/save-proposal.test.mjs`
- `src/server/use-cases/save-quote.ts`
- `src/server/use-cases/save-quote.test.mjs`
- `src/server/use-cases/save-contract.ts`
- `src/server/use-cases/save-contract.test.mjs`
- `src/server/use-cases/export-document.ts`
- `src/server/use-cases/export-document.test.mjs`
- `src/server/use-cases/feishu-delivery.ts`
- `src/server/use-cases/feishu-delivery.test.mjs`
- `src/server/use-cases/stage-progress.ts`
- `src/server/use-cases/material-search.ts`
- `src/server/use-cases/review-generated-image.ts`
- `src/server/use-cases/review-generated-image.test.mjs`
- `src/server/renderers/document-export.ts`
- `src/server/providers/feishu.ts`
- `src/app/api/projects/[projectId]/creative-directions/[directionId]/expansions/generate/route.ts`
- `src/app/api/projects/[projectId]/creative-directions/[directionId]/expansions/[expansionId]/atmosphere-image/generate/route.ts`
- `src/app/api/projects/[projectId]/proposal/route.ts`
- `src/app/api/projects/[projectId]/quote/route.ts`
- `src/app/api/projects/[projectId]/contract/route.ts`
- `src/app/api/projects/[projectId]/contract/export/route.ts`
- `src/app/api/projects/[projectId]/feishu-delivery/route.ts`
- `src/app/api/projects/[projectId]/generated-images/[imageId]/review/route.ts`
- `src/app/api/dashboard/route.ts`
- `src/app/api/scoring-rules/[ruleId]/versions/route.ts`
- `src/server/workers/handlers.ts`
- `src/app/api/projects/[projectId]/workspace/route.ts`
- `src/components/workspace/api.ts`
- `src/components/workspace/workspace-shell.tsx`
- `src/server/database/schema.sql`
- `src/server/providers/oss.ts`
- `src/server/repositories/jobs.ts`
- `src/server/repositories/ai-task-logs.ts`
- `src/server/repositories/ai-task-logs.test.mjs`
- `src/server/repositories/audit-logs.ts`
- `src/server/repositories/ai-usage.ts`
- `src/server/use-cases/controlled-file-access.ts`
- `src/app/api/admin/governance/route.ts`
- `src/app/api/projects/[projectId]/assets/[assetId]/access/route.ts`
- `src/app/api/projects/[projectId]/document-exports/[exportId]/access/route.ts`
- `src/app/api/projects/[projectId]/assets/[assetId]/preview/route.ts`
- `src/app/api/projects/[projectId]/assets/[assetId]/download/route.ts`
- `src/app/api/projects/[projectId]/document-exports/[exportId]/preview/route.ts`
- `src/app/api/projects/[projectId]/document-exports/[exportId]/download/route.ts`
- `src/server/providers/oss.test.mjs`
- `src/app/api/projects/[projectId]/route.ts`
- `src/app/api/projects/[projectId]/feishu-receivers/route.ts`
- `src/app/api/projects/[projectId]/feishu-receivers/[receiverId]/route.ts`
- `src/server/repositories/feishu-receivers.ts`
- `src/app/api/projects/[projectId]/quote/review/route.ts`
- `src/app/api/projects/[projectId]/contract/review/route.ts`
- `src/server/use-cases/review-commercial-document.ts`
- `src/server/use-cases/review-commercial-document.test.mjs`
- `src/app/api/projects/[projectId]/technical-feasibility/review/route.ts`
- `src/server/use-cases/review-technical-feasibility.ts`
- `src/server/use-cases/review-technical-feasibility.test.mjs`
- `src/app/api/projects/[projectId]/creative-directions/[directionId]/review/route.ts`
- `src/server/use-cases/review-creative-direction.ts`
- `src/server/use-cases/review-creative-direction.test.mjs`
- `src/app/api/admin/audit-logs/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/server/use-cases/create-user.ts`
- `src/server/use-cases/create-user.test.mjs`

已执行迁移：

- `creative_expansions` 表已创建
- `generated_images` 表已创建
- `proposals` 表已创建
- `quotes` 表已创建
- `contracts` 表已创建
- `document_snapshots` 表已创建
- `document_exports` 表已创建
- `feishu_deliveries` 表已创建
- `material_embeddings` 表已创建
- `material_search_results` 表已创建
- `generated_images` 已增加人工审核状态、备注、审核人和审核时间字段
- `scoring_rules` 已增加当前版本字段
- `scoring_rule_versions` 表已创建，已有规则已回填 v1
- 现有项目 `project_stage_states` 已回填
- `ai_task_logs` 表已创建并通过真实数据库 smoke；临时 smoke 记录已清理
- `audit_logs.project_id` 与 created/project/actor/action 索引已完成真实迁移
- `project_feishu_receivers` 表已创建
- `feishu_deliveries.receiver_ref_id` 字段已创建

已通过：

- `npm run typecheck`（治理与受控访问接入后）
- `npm run lint`（治理与受控访问接入后）
- `npm run build`（治理与受控访问接入后）
- Neon 真实迁移 smoke：`audit_logs.project_id=true`，`audit_logs_project_created_idx` 存在
- Neon governance repository smoke：写入并读回 1 条带 project_id 的临时审计记录，查询 AI 使用统计成功，验证后已删除临时记录
- `npm run typecheck`（AI telemetry 代码接入后）
- `npm run lint`（AI telemetry 代码接入后）
- `node --test --import tsx src/server/repositories/ai-task-logs.test.mjs src/server/use-cases/generate-document-drafts.test.mjs src/server/use-cases/generate-atmosphere-image.test.mjs src/server/use-cases/review-generated-image.test.mjs`
- `npm run build`（AI telemetry 代码接入后）
- Neon 真实迁移 smoke：`ai_task_logs` 表存在
- Neon repository smoke：写入并读回 1 条 `ai_task_logs` 临时记录，`provider=local_smoke`、`totalTokens=3`，验证后已删除临时记录
- `node --test --import tsx src/server/use-cases/feishu-delivery.test.mjs`
- `node --test --import tsx src/server/use-cases/export-document.test.mjs src/server/use-cases/save-contract.test.mjs src/server/use-cases/save-quote.test.mjs src/server/use-cases/save-proposal.test.mjs src/server/use-cases/generate-atmosphere-image.test.mjs`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- P1 全量服务端测试：19/19 通过
- P1 Neon 真实迁移：1 条已有评分规则回填 v1，1 张已有氛围图回填为待审核
- P1 真实数据库 smoke：氛围图确认后写入 1 条审计记录；临时评分规则连续保存得到 v1、v2，验证后已清理临时数据
- 浏览器检查：`http://localhost:3000/` 正常打开，无控制台错误和横向溢出；当前浏览器无登录态，未执行登录后按钮点击
- 商务文档草稿真实 smoke：豆包 Responses API 生成提案、报价、合同并写入 v3 快照
- 飞书 tenant token 连通性检查：`feishu auth reachable: true`
- 素材 embedding 连通性检查：`ark multimodal embedding reachable: true; dimensions: 2048`
- 素材语义检索真实 smoke：项目 `耐克 / 世界杯` 命中 1 条素材，Top score `0.3958`
- 角色仪表盘真实 SQL smoke：当前活跃 admin 用户返回 `cards=3`、`sections=3`、`projects=2`
- `npm run worker:once` 验证 `creative_expansion_generation`
- `npm run worker:once` 验证 `atmosphere_image_generation`
- `npm run worker:once` 验证 `document_export`
- `node --test --import tsx src/server/providers/oss.test.mjs src/server/repositories/ai-task-logs.test.mjs`
- `node --test --import tsx src/server/providers/oss.test.mjs src/server/use-cases/export-document.test.mjs src/server/use-cases/save-contract.test.mjs src/server/use-cases/save-quote.test.mjs src/server/use-cases/save-proposal.test.mjs src/server/use-cases/feishu-delivery.test.mjs src/server/use-cases/generate-document-drafts.test.mjs src/server/use-cases/generate-atmosphere-image.test.mjs src/server/use-cases/review-generated-image.test.mjs src/server/repositories/ai-task-logs.test.mjs src/server/repositories/scoring-rules.test.mjs`（21/21 通过）
- `npm run typecheck`（受控访问 preview/download 接入后）
- `npm run lint`（受控访问 preview/download 接入后）
- `npm run build`（受控访问 preview/download 接入后）
- 只读抽查 `ai_task_logs` 最近 8 条：当前库返回 0 条，因此 provider response id/token/图片/embedding 明细仍需等下一次真实 Ark/OpenAI 任务完成后验证
- `npm run typecheck`（项目基础信息与飞书接收对象接入后）
- `npm run lint`（项目基础信息与飞书接收对象接入后）
- `npm run build`（项目基础信息与飞书接收对象接入后）
- `node --test --import tsx src/server/use-cases/feishu-delivery.test.mjs src/server/providers/oss.test.mjs src/server/repositories/ai-task-logs.test.mjs`（7/7 通过）
- Neon 真实迁移 smoke：`project_feishu_receivers` 表存在，`feishu_deliveries.receiver_ref_id` 字段存在
- `node --test --import tsx src/server/use-cases/review-commercial-document.test.mjs src/server/use-cases/save-quote.test.mjs src/server/use-cases/save-contract.test.mjs`（6/6 通过）
- `npm run typecheck`（报价/合同审核流转接入后）
- `npm run lint`（报价/合同审核流转接入后）
- `npm run build`（报价/合同审核流转接入后）
- `node --test --import tsx src/server/use-cases/review-technical-feasibility.test.mjs src/server/use-cases/review-creative-direction.test.mjs src/server/use-cases/review-commercial-document.test.mjs`（7/7 通过）
- P2 全量服务端测试：`node --test --import tsx $(rg --files src | rg 'test\\.mjs$')`（28/28 通过）
- `npm run typecheck`（技术阻塞、创意审核、审计筛选接入后）
- `npm run lint`（技术阻塞、创意审核、审计筛选接入后）
- `npm run build`（技术阻塞、创意审核、审计筛选接入后）
- 管理员 smoke：临时管理员登录后工作台正常渲染“技术不可行 / 阻塞管理闭环”“审计查询”“创意方向审核流”，无控制台错误、无横向溢出；临时用户、会话和 cookie 文件已清理
- API smoke：`GET /api/admin/audit-logs?limit=3` 使用临时管理员会话返回 `{ items, total, limit, offset, hasMore }` 分页结构；临时用户、会话和 cookie 文件已清理
- `node --test --import tsx src/server/use-cases/create-user.test.mjs`（1/1 通过）
- P3 全量服务端测试：`node --test --import tsx $(rg --files src | rg 'test\\.mjs$')`（29/29 通过）
- `npm run typecheck`（管理员创建系统用户接入后）
- `npm run lint`（管理员创建系统用户接入后）
- `npm run build`（管理员创建系统用户接入后，确认 `/api/admin/users` 路由编译）

真实 smoke 记录：

- 创意深化 job：`e44b2e12-909a-4d7c-975b-ccf74b715633`，状态 `succeeded`，写入 5 条大纲，artifact：`97f09785-329e-4449-8d99-fecb0b77d3d8`
- 氛围图 job：`64eea2be-3066-4b74-83bf-0e81e00b2d13`，状态 `succeeded`，generated image：`3c8b66c4-8eeb-468f-ac38-9814c9093c52`，artifact：`de4ef04a-f42c-4e57-8b5b-a9f811b1aad8`
- 提案 smoke：proposal `4833c88a-bc55-4138-923e-cf1846789ac5` 已保存到 v2；快照 `fe5c1ef3-4384-4f27-9297-8e69e2fb44e3` / `97541234-f8dd-408e-b679-a61b92f70a89`；artifact `095535bc-4d2a-44ac-a00c-2c410e7ede37` / `0d9d1625-6d84-42b7-986b-2f2042613697`
- 报价 smoke：quote `0fb780a1-5e4f-4f14-ad39-ba408d0f94ee` 已保存到 v2，总价 `54000`；快照 `e1ab3ca8-fa08-4c12-8594-9de8821654d4` / `23684b7c-1d28-493f-92c0-d302cfeb25bd`；artifact `c979983a-3b47-4f9d-a837-76f9be2b3fe6` / `e5d8f60b-156d-49b4-b492-c2d57b9a9e71`
- 合同 smoke：contract `c93cdeff-18a2-47aa-a221-fecb51c8773f` 已保存到 v2，状态 `waiting_review`；快照 `dc1db804-06a6-4f51-8233-f6fe08f9af46` / `73a11f51-b975-4359-9141-384ac9315126`；当前库内 `contract` artifact 2 条
- 合同导出 smoke：PDF job `1ad1a8da-3218-4c1f-be5a-636294f72357` / export `05a0445c-cd52-4f56-bc4a-0f2c46ed14df` 已成功，文件大小 `52272`；Word job `9ebaeb6c-c393-4ec1-96fd-34f58b007d63` / export `d45fae2d-40e7-45c7-a390-3cd051aecce9` 已成功，文件大小 `9261`；均已上传 OSS，并创建 `document_export` artifact
- 飞书交付真实 smoke：
  - 个人 `open_id` 发送成功：job `46b7e22a-48c6-48d6-a16a-a3f33342cf61`，delivery `08846157-5371-4643-9f06-fb870a9d4fa6`，文档 `https://www.feishu.cn/docx/RwS5d0IFkoFP9zxdgPkcmqaRn7e`，消息 `om_x100b6c86b2193484b17251191ec3d4f`
  - 群 `chat_id` 发送失败：job `7fbbb457-bbb0-4dbb-964c-c663dba9f71d`，delivery `96baaf22-28fc-42c3-97f7-1f4ddc742856`；失败提示为请确认群聊 `chat_id` 正确、机器人已进群、应用拥有发送消息权限
  - 开通消息权限后再次测试群 `chat_id` 仍失败：job `5ce0883c-b2bb-4eb0-b25e-c2587a01c96c`，delivery `3a189bf0-ed35-42e8-8376-dee15ba19ca6`；飞书原始诊断码 `230002`，摘要 `Bot/User can NOT be out of the chat.`，说明机器人不在该群或该 `chat_id` 不是当前机器人可见的群
  - 机器人加入群后，群 `chat_id` 发送成功：job `bd19e4f1-4955-4e13-b4ae-38656a5525c1`，delivery `1148f1fa-5c4f-4257-ac31-29a542a491fd`，文档 `https://www.feishu.cn/docx/VFyxdfru7okMSdxeZBtcuCuwn4b`，消息 `om_x100b6c8703d060a8b1ac6e4882c932e`
- 素材检索 smoke：已真实调用 `doubao-embedding-vision-251215`，并写入 `material_embeddings` / `material_search_results`
- 商务文档草稿 smoke：job `11eeaa56-ae86-4652-8718-b38231029355` 成功；提案 v3、报价 v3、合同 v3 已保存，报价合计 `CNY 150000`

注意：本次继续时队列里只有一条 `creative_expansion_generation` retrying 任务，未再遇到旧 `creative_direction_generation` 抢占。该 expansion 任务重试后已成功。

## 还没完成的核心功能

1. 5-9 合并后三大模块已跑通默认 smoke 和真实 AI smoke；Ark Responses 文字分镜拆分、OpenAI 分镜图片生成、火山方舟 Seedance 视频生成、按场次甲方审核打回明细均已验证通过
2. `ai_task_logs` provider 真实调用 smoke：下一次实际 Ark/OpenAI 任务完成后确认 provider response id/token/维度等字段按供应商返回落库
3. 管理端 AI 使用统计可继续深化为趋势图/项目维度统计；实际费用在未接账单 API 前保持空值，不以估算冒充真实扣费
4. 项目成员变更、job 重试/取消、飞书补发等治理动作可继续补审计细节；管理员创建系统用户已写审计
5. 可继续做真实业务 smoke：用现有项目实际点击一次技术阻塞/解除、创意提交/驳回/重新提交并确认审计记录；本轮为避免污染项目状态，只做了 API/浏览器渲染 smoke 和单元状态映射测试

## 推荐给下一个 Agent 的启动方式

请先阅读：

1. `AGENTS.md`
2. `docs/PRD_AND_EXECUTION_PLAN.md`
3. `docs/PROJECT_STATUS.md`

然后执行：

```bash
npm run typecheck
npm run lint
npm run build
```

继续任务建议：

1. 等下一次真实 Ark/OpenAI 任务完成后抽查 `ai_task_logs` 的 provider response id、token、图片/embedding 明细。
2. 如需要更强验收，可在测试项目上执行一次真实技术阻塞/解除、创意提交/驳回/重新提交，并检查审计筛选结果。
3. 模块三视频生成已接真实火山方舟视频生成接口，并通过 `STAGE_5_9_REAL_AI_SMOKE=1 npm run smoke:stage-5-9` 验证真实生成、下载和 OSS 转存。
