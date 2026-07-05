# AUGC Flow

内部 AIGC 视频项目协同工作台。第一阶段聚焦前四步商业业务闭环：需求洽谈、技术可行性评估、创意方向提案、方向初选与报价签约。

## 本地启动

```bash
npm install
npm run dev
```

默认地址：

```text
http://localhost:3000
```

`npm run dev` 会同时启动 Web/API 和后台任务 worker。只想单独启动 Web 时使用：

```bash
npm run dev:web
```

本地调试 worker 时仍可单独运行：

```bash
npm run worker
npm run worker:once
```

后台 worker 默认并发处理 3 个任务；本地或部署环境可用 `JOB_WORKER_CONCURRENCY=2` 这类配置调整。`npm run worker:once` 仍只处理 1 个任务，适合单步调试。

## 环境变量

复制无密钥模板：

```bash
cp .env.local.example .env.local
```

然后补齐：

- `DATABASE_URL`：Supabase Postgres 连接串，建议使用 Dashboard 给出的 pooled connection，并保留 `sslmode=require`。
- `JOB_WORKER_CONCURRENCY`：后台任务并发数，默认 `3`，建议按 AI provider 限流能力保守调整。
- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`：Supabase 项目公开配置。
- `SUPABASE_SERVICE_ROLE_KEY`：只允许服务端读取的 Supabase 管理密钥。
- `ALIYUN_OSS_*`：阿里云 OSS 服务端上传签名配置。
- `ARK_API_KEY`：火山方舟豆包模型调用。
- `OPENAI_API_KEY` / `OPENAI_BASE_URL`：OpenAI 兼容中转站，用于 `gpt-image-2-all` 氛围图生成。
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET`：飞书交付。

真实密钥只能放在本地或部署环境变量中，不能提交到仓库。

## 数据库初始化

在 Supabase SQL Editor 或 Postgres 连接上执行：

```bash
npm run --silent supabase:sql:manifest
npm run --silent supabase:sql
psql "$DATABASE_URL" -f supabase/migrations/20260630000000_initial_backend_schema.sql
npm run supabase:verify
```

当前 schema 覆盖项目、阶段状态、用户、资产、AI job、job event、artifact、审计日志、SOP 1-10 业务表和 Supabase RLS 兼容层。详见 [docs/SUPABASE_MIGRATION.md](/Users/zzymima0000/Documents/跃然agent/docs/SUPABASE_MIGRATION.md)。

## 创建内部账号

系统默认不开放注册。首次使用前，用服务端脚本创建管理员或团队成员账号：

```bash
ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="至少12位的强密码" \
ADMIN_NAME="管理员姓名" \
ADMIN_ROLE="admin" \
npm run user:create
```

`ADMIN_ROLE` 可选 `admin`、`business`、`creative`。创建后访问 `http://localhost:3000` 登录。API 会根据真实 session cookie 和角色做服务端权限校验。

## 验证命令

```bash
npm run typecheck
npm run lint
npm run test:baseline
npm run build
```

`npm run test:baseline` 是当前防回归基线，保护：

- SOP 1 Brief 工作区保持简洁：原始信息投放区、上传后资料目录、标准化 Brief、待补充信息投放区和 Brief 推进确认；不得恢复入口说明小字、重复红色待确认区或旧式大回复框。
- SOP 1 Brief 前后端流转保持一致：标准化完成后仍停留在 `brand_requirement_intake`；Brief 推进确认后自动进入风险体检并真实生成风险体检卡，失败时保留可重试入口；待补充问题按题独立提交并移除已答问题；无待补充项后复用 `brief_confirmation` 显示甲方审核入口。
- SOP 1 标准化 Brief 表格保留轻量强调标记渲染能力，包括加粗、文字色和背景色，不引入重型富文本框架。
- SOP 2 风险体检卡保持一个简洁结论面板：最多 5 个“影响接单的点”，按红线、高风险、中风险、事实缺口稳定排序，高风险视觉必须明显强于中低风险，不恢复 `关键依据` 墙、泛化步骤条或多层装饰容器。
- SOP 3 创意视觉提案保持当前任务聚焦：主工作区不同时堆叠四方向、故事大纲、Round 1 三风格图准备、深化内容、Round 面板和最终提案整理；底部流程进展图只做历史预览。
- SOP 3 前后端规则一致：第一轮必须按“先生成故事大纲 -> 再选择方向 -> 再补齐三风格图 -> 再发 Round 1 甲方审核”执行；不得退化成先选方向才有故事大纲、只发方向卡或绕过三风格图；甲方通过后持久化保留方向；第二轮必须按“扩展完整故事大纲 -> 生成约 500 字完整剧本 -> 人工确认完整剧本 -> 拆分 4 个精彩分镜场景 -> 生成深化视觉图”深化，后端 job operation 与 artifact 类型也在基线内；甲方打回时停在修订状态。
- SOP 3 UI/生成基线：方向卡保留明显的 `人工改写` 与 `生成/重新生成故事大纲` 操作；Round 1 材料主按钮固定在方向卡区域下方；每张 Round 1 风格图可单张生成/重新生成；二维、三维皮克斯、写实三套提示词必须保持明显风格区隔。
- SOP 4 工作量估算基线：工作量卡必须保留 `AI 预估` 动作，后端真实读取已确认 SOP 3 第二轮提案/方向/故事大纲上下文并通过文本模型生成结构化 `generated` 草稿；AI 草稿不得绕过人工保存进入报价，缺模型配置或模型输出异常必须给自然语言反馈；交付清单必须显式确认后才推进 SOP 5。
- SOP 5 脚本分镜基线：标准剧本生成后即可拆分文字分镜，但拆分成功必须停留在 `script_storyboard_confirmation`，不得直接跳到 `storyboard_image_canvas`；标准剧本格式校验必须接受 `破晓`、`拂晓`、`黎明`、`日出`、`午夜` 等常见影视时间标签，不能把完整的 `破晓 内/外` 场景行误判为缺少必填格式；必须依次 `确认文字分镜`、确认人物/场景清单、生成并审核设定图后，才进入分镜图生成。编辑分镜会重置确认状态，确认文字分镜时必须刷新人物/场景与分镜的 `source_shot_ids` 关联，保证分镜图生成带上对应设定图参考。
- SOP 5 人物/场景设定图生成按钮必须按卡片维度锁定：生成某一个人物或场景时，只禁用当前卡片的 `生成` 按钮，不得让其它人物卡片、场景卡片或同一区域其它生成入口一起置灰。
- SOP 6 分镜图片生产基线：候选图、全部分镜导航和主预览必须保持可读的大尺寸排列，不能改回强行压缩到一屏的小尺寸布局；点击图片后的全图预览必须覆盖左侧项目侧边栏。
- SOP 7 AI 视频生成基线：视频生成工作台必须复用分镜图片生成的大预览、版本候选、全部分镜导航和下方生成控制台布局；点击视频可全屏预览；右侧导航缩略图必须能从已生成视频关联的源分镜图回填，不得退回占位图。
- SOP 8/9 A copy / B copy 成片审核基线：工作区必须保持标准化 Brief 风格的文字层级，使用清晰标题、加粗字段标签、紧凑信息块、时间戳反馈字段和少量说明文案；不得恢复长段解释文案，也不得改变上传、审核链接、推进 B copy / 归档的业务逻辑。
- SOP 10 完整归档基线：工作区必须保持标准化 Brief 风格的结构化文字层级，使用 `完整归档` 标题、`交付清单` / `归档状态` / `完成时间` 概览字段、两列 `归档条件`、清晰字段标签和紧凑正文；不得恢复每个勾选项下方的长说明文案，也不得改变保存归档、完成归档并关闭项目的业务逻辑。
- 甲方外部审核链接保持密钥门禁：未校验密钥不得返回或展示业务内容；Round 1 审核必须带故事内容；合同审核展示工作台同源完整合同正文；完整剧本审核展示复用标准剧本格式规范校验/规范化后的标准剧本正文。
- 风险卡底部只常驻 `可以接` / `不可以接`；`不可以接` 后才选择 `Brief 不足` 或 `项目背景/项目本身原因` 并补充理由。
- 后端风险决策只允许 `accept` / `reject`，并按原因回退 SOP 1 或阻塞 SOP 2。
- 阶段页签绑定当前工作区，`npm run dev` 同时启动 Web/API 和后台 worker。

任何修改上述区域前后都需要运行 `npm run test:baseline`，核心流程改动还需要继续运行 `npm run typecheck`、`npm run lint` 和 `npm run build`。

## 部署

部署时必须同时启动 Web/API 进程和 worker 进程。详见 [docs/DEPLOYMENT.md](/Users/zzymima0000/Documents/跃然agent/docs/DEPLOYMENT.md)。

## 当前真实能力边界

- 项目创建与读取走 `/api/projects`，必须连接真实数据库。
- 登录使用服务端 session cookie；项目、资产、任务和配置 API 均要求已登录。
- 商务和管理员可以创建项目、发起需求结构化；创意团队只能访问已分配项目和上传资料。
- OSS 上传 URL 走服务端签名，缺少 OSS 配置时会返回自然语言阻塞提示。
- AI job 通过 Postgres 队列入队，由独立 worker 领取、续租、重试和落库；缺少 API key 时不会伪造成功。
- 右侧 AI 进度面板消费持久化 `job_events`，不展示假百分比。
- 5-12 步只做阶段导航预留，不提供假执行接口。
