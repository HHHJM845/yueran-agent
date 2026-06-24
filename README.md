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

另开一个终端启动后台任务 worker。AI 任务不会在 API 请求里直接长时间执行：

```bash
npm run worker
```

本地调试只消费一个待处理任务时可以运行：

```bash
npm run worker:once
```

## 环境变量

复制无密钥模板：

```bash
cp .env.local.example .env.local
```

然后补齐：

- `DATABASE_URL`：Postgres 兼容数据库连接，建议优先看 Neon 或 Supabase。
- `ALIYUN_OSS_*`：阿里云 OSS 服务端上传签名配置。
- `ARK_API_KEY`：火山方舟豆包模型调用。
- `OPENAI_API_KEY` / `OPENAI_BASE_URL`：OpenAI 兼容中转站，用于 `gpt-image-2-all` 氛围图生成。
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET`：飞书交付。

真实密钥只能放在本地或部署环境变量中，不能提交到仓库。

## 数据库初始化

在 Postgres 数据库上执行：

```bash
psql "$DATABASE_URL" -f src/server/database/schema.sql
```

当前 schema 覆盖项目、阶段状态、资产、AI job、job event、artifact、审计日志等第一版底座。

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
npm run build
```

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
