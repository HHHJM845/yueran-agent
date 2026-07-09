# 项目 Agent 工作约束

本文件是本项目所有 Agent 在代码构建、修复、评审、测试时必须遵守的项目级约束。开始任何实现前，必须先阅读本文件和 `docs/PRD_AND_EXECUTION_PLAN.md`。

## 1. 当前目标

本项目是内部 AIGC 视频项目协同工作台。当前目标是把已确认的 6 个功能模块、10 个 SOP 流程按生产级标准落地到项目工作台：

1. Brief 收集与需求结构化
2. 风险体检卡
3. 两轮创意视觉提案
4. 工作量估算、报价合同与交付清单
5. 脚本、人物/场景设定与文字分镜确认
6. 分镜图片生产与三批审核
7. AI 视频生成与导演下发
8. A-copy 生成与多轮修改
9. B-copy 定稿确认与交付清单核对
10. 结算交付与完整归档

实现层继续保留现有阶段键与数据库状态，用于兼容历史数据、状态机流转和阶段回溯；业务文案、流程顺序、工作台卡片和审核场景必须按上述 10 个 SOP 对齐。

## 2. 生产级原则

- MUST 按生产级可上线标准实现，不允许 demo-only、临时脚本、占位流程、假成功或静默失败。
- MUST 接真实后端、真实数据库、真实文件存储或真实 provider 接口。
- MUST NOT 用静态 mock、本地硬编码响应或假接口冒充核心业务能力。
- MAY 使用本地 seed 数据辅助调试，但 MUST NOT 把 seed/mock 当作最终功能。
- MUST 将所有核心状态持久化到数据库或后端状态机。
- MUST NOT 只依赖前端内存保存项目进度、任务状态或业务产物。
- MUST 支持页面刷新、重新打开、重新登录后恢复项目当前阶段和产物。
- 如果真实接口未就绪，MUST 显式标记阻塞，并补充接口契约，不得伪造成功。

## 3. 技术栈约束

前端：

- Next.js
- React
- TypeScript
- shadcn/ui

后端：

- Node.js / Next.js API 服务
- 部署目标为阿里云

数据库：

- Postgres 兼容托管数据库
- 优先选择成本可控的 Neon 或 Supabase
- 如后续确定使用阿里云，也必须通过 `DATABASE_URL` 接入

文件存储：

- 阿里云 OSS

AI provider：

- 火山方舟豆包
- OpenAI 图像生成

飞书：

- Feishu OpenAPI

## 4. 模型与 provider 约束

模型名从环境变量读取，不允许在业务代码中散落硬编码。

当前约定：

```env
ARK_TEXT_STRUCTURING_MODEL=doubao-seed-2-1-pro-260628
ARK_IMAGE_VIDEO_UNDERSTANDING_MODEL=doubao-seed-2-0-lite-260215
ARK_VIDEO_GENERATION_MODEL=doubao-seedance-1-5-pro-251215
ARK_MATERIAL_EMBEDDING_MODEL=doubao-embedding-vision-251215
OPENAI_IMAGE_MODEL=gpt-image-2-all
```

provider 路由：

```env
TEXT_STRUCTURING_PROVIDER=volcengine_ark
IMAGE_VIDEO_UNDERSTANDING_PROVIDER=volcengine_ark
ATMOSPHERE_IMAGE_PROVIDER=openai
VIDEO_GENERATION_PROVIDER=volcengine_ark
MATERIAL_EMBEDDING_PROVIDER=volcengine_ark
```

## 5. 安全与密钥约束

- MUST NOT 提交 `.env.local`、真实 `.env` 或任何含密钥的文件。
- MUST 提供 `.env.local.example` 或 `.env.example` 作为无密钥模板。
- MUST NOT 将任何 API key、AccessKey、Secret、数据库密码写入代码、文档示例、测试快照、日志或前端 bundle。
- MUST 确保前端只能访问明确允许公开的环境变量。
- MUST 确保阿里云 OSS、数据库、飞书、AI provider 的密钥只在服务端读取。
- MUST NOT 在日志中输出完整 token、key、secret、签名 URL 或客户合同内容。

## 6. 角色与权限约束

只实现三类角色仪表盘：

- 商务团队
- 创意团队
- 管理团队/管理员

后续实现权限时，任何页面和 API 都必须同时做前端显示控制和服务端权限校验。不能只靠前端隐藏按钮。

## 7. 状态机约束

所有项目阶段必须通过状态机流转。

阶段状态：

```text
not_started
in_progress
waiting_review
needs_revision
approved
blocked
completed
archived
```

AI 任务状态：

```text
queued
processing
succeeded
failed
retrying
cancelled
```

实现新功能时，如果功能会改变项目进度、AI 任务进度、合同状态或飞书交付状态，必须写入持久化状态，不能只更新 UI。

报价与合同状态：

```text
draft
waiting_review
needs_revision
confirmed
sent
signed
terminated
```

如果阶段不可行、资料不足、飞书失败、AI 失败或报价/合同被驳回，MUST 保存失败或回退状态，并给出可恢复路径。

## 8. 自然语言反馈约束

所有 loading、success、empty、error、blocked 状态都 MUST 有自然语言反馈。

MUST NOT 直接把以下内容展示给最终用户：

- HTTP 原始错误
- 数据库错误栈
- SDK 原始异常
- 模型原始异常
- 未处理的 JSON
- 英文技术堆栈

错误提示 MUST 说明发生了什么、可能原因、用户下一步可以做什么。服务端日志 MAY 保留诊断信息，但必须过滤密钥和敏感内容。

## 9. UI 与交互约束

- 工作台采用左侧项目列表、右侧当前项目工作区。
- 项目列表必须展示品牌名、项目名、当前阶段、负责人、截止时间、状态。
- 右侧工作区根据项目状态机展示当前阶段界面。
- 12 步阶段导航必须始终能反映真实持久化状态。
- 表单、异步按钮、上传、AI 生成、飞书发送都必须有明确反馈，避免重复提交。
- UI 改动必须检查响应式、文本溢出、空状态、错误状态和禁用状态。

## 10. 数据与文件约束

- 上传文件必须进入资产表并保存 OSS 地址、文件类型、上传人、项目 ID、解析状态。
- PDF、Word、图片、视频、飞书链接都必须以资产或外部资源记录入库。
- AI 生成图片需要保存生成任务、prompt、模型名、OSS 地址、失败原因和重试次数。
- 提案和合同需要保存历史快照。

## 11. 飞书交付约束

飞书交付必须形成闭环：

1. 创建飞书文档
2. 发送给甲方个人或群
3. 回写飞书文档链接
4. 回写发送对象
5. 回写发送时间
6. 回写发送状态
7. 归档到项目记录

任何飞书发送失败都必须保存失败状态，并给用户自然语言重试建议。

## 12. 构建与验证约束

实现代码后至少进行以下验证：

- TypeScript 类型检查
- lint
- build
- 与本次改动相关的单元测试或集成测试
- 涉及 UI 时进行浏览器检查

如果项目脚本尚未建立，需要在工程底座阶段补齐 `build`、`lint`、`typecheck` 的 npm scripts。

涉及核心流程的改动，MUST 至少验证一条真实或可连接真实 provider 的路径。不得只验证静态页面渲染。

### Brief / 风险体检 / 创意提案 / 报价合同 / 脚本分镜 / Worker 基线

`npm run test:baseline` 是当前 SOP 1 Brief 简化工作区、SOP 2 风险体检卡线性决策流程、SOP 3 创意视觉提案聚焦流、SOP 4 工作量估算/报价合同/交付清单聚焦流、SOP 5 脚本设定与文字分镜聚焦流、阶段页签显示和本地 worker 自动启动的回归基线。任何修改以下区域前后都 MUST 运行并保持通过：

- `src/components/workspace/workspace-shell.tsx` 中 Brief 收集、标准化 Brief、风险体检卡、接单结论相关 UI。
- `src/server/use-cases/structure-requirement.ts` 中 Brief 结构化、待补充问题过滤和 SOP 1 阶段保持规则。
- `src/app/api/projects/[projectId]/requirements/confirm/route.ts` 中 Brief 推进确认、自动进入风险体检和自动生成风险体检卡的流转规则。
- `src/app/api/projects/[projectId]/client-reviews/route.ts`、`src/server/use-cases/client-review.ts` 与 `src/components/workspace/api.ts` 中 Brief 甲方审核 `brief_confirmation` 契约。
- `src/components/workspace/api.ts` 中风险体检卡生成、决策提交相关 client contract。
- `src/app/api/projects/[projectId]/risk-check/route.ts` 与 `src/server/use-cases/risk-check-card.ts` 中风险决策校验和状态机流转。
- `src/components/workspace/risk-check-view-model.ts` 与 `src/components/workspace/risk-check-view-model.test.mjs` 中 SOP 2 风险问题视图模型与回归测试。
- `src/components/workspace/sop3-focused-flow-view-model.ts`、`src/server/use-cases/creative-proposal-rounds.ts`、`src/server/use-cases/generate-creative-expansions.ts`、`src/server/use-cases/client-review.ts` 与对应测试中 SOP 3 前后端流转规则。
- `src/components/workspace/sop4-focused-flow-view-model.ts`、`src/components/workspace/workspace-shell.tsx`、`src/components/workspace/api.ts`、`src/app/api/projects/[projectId]/workload-estimate/route.ts`、`src/app/api/projects/[projectId]/workload-estimate/generate/route.ts` 与 `src/server/use-cases/workload-estimate.ts` 中 SOP 4 工作量估算、AI 预估草稿、报价合同和交付清单流转规则。
- `src/components/workspace/sop5-focused-flow-view-model.ts`、`src/components/workspace/workspace-shell.tsx`、`src/components/workspace/api.ts`、`src/app/api/projects/[projectId]/storyboard-scenes/confirm-sequence/route.ts`、`src/server/use-cases/script-storyboard.ts`、`src/server/use-cases/storyboard-sequence.ts`、`src/server/repositories/story-production.ts`、`src/server/use-cases/production-setup.ts` 与对应测试中 SOP 5 脚本生成、标准剧本、文字分镜确认、人物场景清单、设定图门禁和流转规则。
- `src/app/globals.css`、`src/components/workspace/workspace-shell.tsx` 与 `src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs` 中 SOP 6 分镜图片生产候选图/分镜导航对齐、AI 视频生成工作台对齐、视频全屏预览、放大预览层级规则，以及 SOP 8/9 A copy / B copy 成片审核和 SOP 10 完整归档工作区文字层级规则。
- `src/components/workspace/workspace-shell-stage-tabs.test.mjs` 保护阶段页签和当前工作区绑定，避免自动编号和阶段壳错乱。
- `src/app/client-review/[token]/page.tsx`、`src/app/api/client-review/[token]/route.ts`、`src/app/api/client-review/[token]/unlock/route.ts` 与 `src/server/use-cases/client-review.ts` 保护甲方外部审核链接的密钥门禁、审核内容完整性和历史节点展示。
- `src/scripts/dev-with-worker.ts` 与 `src/scripts/dev-with-worker.test.mjs` 保护 `npm run dev` 同时启动 Web/API 和后台 worker。

该基线保护的行为包括：

- SOP 1 工作区只保留客户原始信息投放区、资料目录、标准化 Brief、待补充信息投放区和 Brief 推进确认；资料目录只在上传素材后展示；不得恢复“微信聊天/客服回复/截图/飞书链接/本地文件”等副标说明文案。
- SOP 1 标准化 Brief 生成或补充整理完成后，项目必须停留在 `brand_requirement_intake`，不得自动推进到 `technical_feasibility`；进入风险体检只能由 Brief 推进确认触发，且确认动作必须真实调用风险体检生成逻辑，自动生成风险体检卡，失败时要在风险阶段保留自然语言错误与可重试入口。
- SOP 1 标准化 Brief 表格不得恢复重复的红色“待确认项/待选项”区域；待补充问题只在下方投放区展示，并使用浅红提示样式。
- SOP 1 待补充问题必须按问题渲染独立 Answer 区块，提交时只围绕当前问题更新 Brief；已回答问题必须从待补充列表移除，不得重复追问。
- SOP 1 Brief 上传/手写后，标准化 Brief 生成或补充整理完成时必须自动滚动到结果区并保持标准化 Brief 表格可见；生成任务状态必须读取持久化 `requirement_structuring` job，切换页面或项目再返回时继续展示生成中、已完成或失败状态，不得只依赖前端本地内存。
- SOP 1 标准化 Brief 表格渲染层必须保留轻量强调标记支持，但所有字段小标题保持灰黑色，重点内容和 `**粗体**`、`==重点==`、`{red:文字}` 等标记只能渲染为加粗，不得改变字体颜色或背景色；不得引入重型富文本框架替代当前轻量渲染。
- SOP 1 无剩余待补充项后必须显示甲方 Brief 审核入口，复用既有 `brief_confirmation` reviewType，不得新增臆造审核类型或 schema。
- 项目基础信息放在左侧项目菜单悬停卡中，不回到右侧 Brief 工作区。
- SOP 2 风险体检卡生成后只展示一个简洁结论面板，最多 5 个“影响接单的点”，风险项必须按红线、高风险、中风险、事实缺口从上到下稳定排序，高风险项视觉必须比中低风险更醒目；不得展示 `关键依据`、`需要人工确认的依据`、`5 个主步骤`、`几 CP`、`三批` 等无关装饰。
- SOP 2 风险评估“综合判断”总评必须使用健康、良好、中等、可承受、可执行、可行性较高等正向可推进表达；不得在综合判断里展示“风险偏高”或“落地风险偏高”。
- SOP 2 主操作只常驻 `可以接` / `不可以接`；`可以接` 使用品牌蓝主按钮，`不可以接` 后才收集 `Brief 不足` 或 `项目背景/项目本身原因` 与理由补充。
- `Brief 不足` 回退 SOP 1 补资料，项目本身原因阻塞在 SOP 2；后端只允许 `accept` / `reject` 两类决策。
- SOP 3 工作区按当前任务聚焦展示：生成方向、生成故事大纲、内部选择、Round 1 三风格图准备、等待甲方反馈、深化确认方向、等待最终确认、最终提案整理不会同时堆叠。
- SOP 3 底部只保留只读流程进展图，可查看历史摘要，但不能触发回滚或改变项目状态。
- SOP 3 第一轮必须按当前基线顺序执行：先为 4 个方向生成故事大纲，再选择 1-4 个方向，再为已选方向补齐二维风格、三维皮克斯风格、写实风格三张静态场景图，最后保存 Round 1 完整提案包并发给甲方；不得退化成先选方向才有故事大纲、只发方向卡或绕过三风格图。
- SOP 3 方向卡必须保留明显的 `人工改写` 次操作和 `生成/重新生成故事大纲` 主操作；Round 1 材料主按钮必须固定在方向卡区域下方，不得只放回顶部操作条。
- SOP 3 Round 1 每张风格图必须支持单张 `生成/重新生成`，复用现有图片生成 job 流程和自然语言反馈；三套固定提示词必须保持二维插画、动画电影级 3D、真实商业摄影的明显区隔，不得改回同质化描述。
- SOP 3 Round 1 甲方审核页必须展示对应方向故事内容；创建 Round 1 提案包前必须已存在故事大纲，不得只把方向卡和风格图发给甲方。
- SOP 3 甲方通过 Round 1 后必须持久化保留方向；Round 2 只对保留方向继续深化，且必须按“生成 700-800 字完整故事 -> 人工确认完整故事 -> 精选 2 个精彩小分镜/高光画面 -> 生成深化视觉图”的顺序执行，不再恢复“先生成深化故事稿/大纲”的独立模型请求。这里的 2 个精彩小分镜只用于生成深化视觉图，每个小分镜生成 1 张深化视觉图；场景卡保留画面风格、展示一条小分镜，不展示风险备注或制作难度；不得恢复成“精彩分镜场景”或正式文字分镜拆解，正式文字分镜只属于 SOP 5。
- AI 生成变慢或超时时，必须优先使用 `jobs`、`job_events`、`ai_task_logs` 和 `npm run ai:latency -- --job-id=<id>` / `--project-id=<id>` 做耗时诊断，区分队列等待、模型调用和非模型处理后再优化，不得只凭猜测调整提示词或并发。
- SOP 3 甲方打回 Round 1 或 Round 2 时，工作区停在修订状态并显示反馈，不能自动推进到深化或最终提案。
- SOP 3 继续复用现有创意方向、Round 提案包、甲方审核、故事大纲、氛围图 API 和后端状态机，不新增数据库子状态机。
- SOP 4 工作量估算必须提供 `AI 预估` 动作，真实读取已确认 SOP 3 第二轮创意提案、方向和故事大纲/深化上下文，通过服务端文本模型 provider 生成结构化估算草稿；缺模型配置或模型输出异常必须给自然语言阻塞/重试提示，不得伪造成功。
- SOP 4 AI 工作量预估只能保存为 `generated` 草稿，不得直接推进到报价；工作区必须继续停留在工作量估算卡，人工点击 `保存工作量估算` 后才进入报价确认。
- SOP 4 交付清单必须显式 `确认清单` 后才能推进到 SOP 5；保存草稿或变更状态不得推进阶段。
- SOP 5 工作区拆成 `脚本设定（完整剧本）` 与 `文字分镜拆解` 两个子标签；不得恢复外部粘贴完整剧本、格式检查、甲方完整剧本确认这些旧机械流程。
- SOP 5 朴素剧本必须由 AI 基于最终 Round 2 创意提案和当前项目上下文生成，修订通过项目内对话指令迭代，不写入跨项目知识库。
- SOP 5 标准剧本生成后即可拆分文字分镜；文字分镜拆分使用 `standardizedScript`，不能再要求脚本包先进入 `client_approved` 或 `locked`。标准剧本格式校验必须接受常见影视时间标签，包括 `破晓`、`拂晓`、`黎明`、`日出`、`午夜`，不得把完整的 `破晓 内/外` 场景行误判为缺少必填格式。
- 甲方外部审核链接必须先输入审核密钥，服务端校验通过后才返回任何业务内容；新生成的审核密钥必须加盐哈希保存，错误提示不得泄露项目内容。所有新生成的甲方审核 URL 必须携带 `#key=` 验证码片段，甲方打开后自动填入验证码但仍需手动点击进入审核；工作台展示和复制的链接也必须是这个完整 URL。合同审核必须展示与工作台一致的完整合同正文；完整剧本审核必须展示复用 `STANDARD_SCRIPT_FORMAT_SPEC` 校验/规范化后的标准剧本正文。
- SOP 5 文字分镜支持按场次编辑、拖拽/上下移动、增删并保存序列；人物和场景清单支持新增、编辑、忽略，忽略项不得阻塞后续推进。
- SOP 5 成功拆分文字分镜后必须停留在 `script_storyboard_confirmation`，工作区展示 `确认文字分镜` 操作；不得直接推进到 `storyboard_image_canvas`。
- SOP 5 文字分镜编辑、排序、新增或删除后必须把相关分镜重置为 `draft`，后续必须重新 `确认文字分镜`；确认动作必须重新同步人物/场景设定清单与 `production_entities.source_shot_ids`，保证 SOP 6 分镜图生成能读取对应设定图参考。
- SOP 5 人物和场景设定必须在文字分镜确认后才能确认清单、生成设定图提示词、生成设定图并提交甲方审核；单张人物/场景设定图生成中的 busy 状态必须按卡片维度隔离，只禁用当前人物或场景卡片的生成按钮，不得把其它人物或场景卡片一起置灰；只有人物/场景设定图审核通过并锁定后，才能进入 `storyboard_image_canvas` 分镜图生成。
- SOP 5-9 生产链路页面只保留核心操作、状态反馈、错误/阻塞原因和必要审核链接信息；脚本设定、文字分镜、人物场景设定、分镜图片、AI 视频生成、导演下发、A copy / B copy 不得恢复模型调用说明、数据库/metadata/回写机制、长段教学提示或“完成后会...”类冗余说明文案。
- SOP 6 分镜图片生产的候选图、全部分镜导航和主预览必须保持可读的大尺寸排列；放大预览必须覆盖左侧项目侧边栏。
- SOP 7 AI 视频生成必须沿用分镜图片生成的工作台结构：大预览、视频版本候选、全部分镜导航和下方生成控制台在同一工作区；点击视频必须打开覆盖侧边栏的全屏预览；右侧全部分镜导航缩略图必须优先显示确认分镜图，并能从已生成视频的 `imageId` 回填源分镜图，不得显示为空占位。
- SOP 8/9 A copy / B copy 成片审核必须保留标准化 Brief 风格的结构化文字层级：标题使用 `A copy 成片审核` / `B copy 定稿确认`，字段块保留 `当前版本`、`审核状态`、`内部说明`，时间戳反馈保留 `时间点`、`修改意见`、`定位状态`、`场次`、`分镜`，流程卡保留紧凑的 `当前阶段` / `下一步` 字段；不得恢复长段说明文案，也不得改变上传、甲方审核链接、推进 B copy 或归档的业务逻辑。
- SOP 10 完整归档必须保留标准化 Brief 风格的结构化文字层级：标题使用 `完整归档`，概览字段保留 `交付清单`、`归档状态`、`完成时间`，归档条件使用紧凑两列字段块，表单字段保留 `交付渠道`、`NAS 归档位置`、`案例展示权`、`售后说明` 和 `完成归档检查`；不得恢复每个勾选项下方的长说明文案，也不得改变保存归档、完成归档并关闭项目的业务逻辑。
- `npm run dev` 必须同时启动 Next Web/API 和 `src/scripts/job-worker.ts`，保留 `npm run dev:web` 与 `npm run worker` 作为单独调试入口。

## 13. 修改范围约束

- 优先做最小可行实现。
- 不借机重构无关代码。
- 不随意升级依赖。
- 不引入未讨论的大型框架替代当前技术路线。
- 涉及跨模块改动时，先保证状态机、权限、错误反馈和数据持久化不被破坏。

## 14. 子 Agent 协作约束

可将后续实现拆给子 Agent，但每个子 Agent 必须有清晰职责和文件边界。

推荐拆分：

- 工程底座 Agent：Next.js、shadcn、项目结构、基础脚本
- 数据模型 Agent：数据库 schema、状态机、权限模型
- 资产 Agent：OSS 上传、资产表、文件解析状态
- AI Agent：豆包/OpenAI provider、任务状态、错误处理
- 飞书 Agent：文档创建、发送、回写记录
- UI Agent：三类仪表盘、项目工作台、阶段导航
- QA Agent：构建、测试、关键流程检查

子 Agent 不得互相覆盖文件，不能回滚其他 Agent 的修改。
