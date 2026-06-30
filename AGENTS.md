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

### Brief / 风险体检基线

`npm run test:baseline` 是当前 SOP 1 Brief 简化工作区与 SOP 2 风险体检卡线性决策流程的回归基线。任何修改以下区域前后都 MUST 运行并保持通过：

- `src/components/workspace/workspace-shell.tsx` 中 Brief 收集、标准化 Brief、风险体检卡、接单结论相关 UI。
- `src/components/workspace/api.ts` 中风险体检卡生成、决策提交相关 client contract。
- `src/app/api/projects/[projectId]/risk-check/route.ts` 与 `src/server/use-cases/risk-check-card.ts` 中风险决策校验和状态机流转。
- `src/components/workspace/risk-check-view-model.ts` 与 `src/components/workspace/risk-check-view-model.test.mjs` 中 SOP 2 风险问题视图模型与回归测试。

该基线保护的行为包括：SOP 2 只常驻展示 `能接（通过）` / `不能接` 两个主操作；`不能接` 后才收集 `Brief 不足` 或 `项目背景/项目本身原因` 与理由补充；`Brief 不足` 回退 SOP 1 补资料，项目本身原因阻塞在 SOP 2。

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
