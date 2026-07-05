# 部署说明

## 进程划分

生产环境至少需要两个进程：

1. Web/API 进程

```bash
npm run build
npm run start
```

2. 后台任务 worker 进程

```bash
npm run worker
```

Web/API 只负责鉴权、入队、读取状态和返回工作台数据。AI 长任务、重试、超时恢复由 worker 处理。不要只部署 Web/API，否则新建任务会停留在 `queued`。

## 阿里云部署建议

推荐用同一个镜像或同一份代码启动两个服务：

- `web`：对外暴露 HTTP 端口，运行 `npm run start`
- `worker`：不暴露公网端口，运行 `npm run worker`

两个进程必须使用同一组服务端环境变量：

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALIYUN_OSS_*`
- `ARK_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_DAYS`
- `JOB_WORKER_CONCURRENCY`

`DATABASE_URL` 必须使用 Supabase Dashboard 给出的 Postgres 连接串。Supabase Publishable Key 和 Service Role Key 不能替代数据库密码。

## Worker 行为

Worker 使用 Postgres 队列表：

- `queued` / `retrying` 任务会被领取。
- 默认单个 worker 进程最多并发处理 3 个任务，可通过 `JOB_WORKER_CONCURRENCY` 调整，取值会限制在 1-8 之间。
- 领取后写入 `processing`、`locked_by`、`lock_expires_at`。
- 长任务会定时续租。
- 任务失败会按 `max_attempts` 自动重试。
- 锁过期任务会被下一个 worker 恢复为重试或失败。

当前可执行任务类型：

- `requirement_structuring`

其他任务类型需要先接入 worker handler，不能通过通用 job API 伪造执行。

## 首次管理员

首次部署后，如果数据库里没有用户，可以直接打开工作台创建首个管理员。也可以用脚本创建：

```bash
ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="至少12位强密码" \
ADMIN_NAME="管理员姓名" \
ADMIN_ROLE="admin" \
npm run user:create
```

创建首个用户后，浏览器 bootstrap 入口会自动关闭。
