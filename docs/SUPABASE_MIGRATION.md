# Supabase Migration

本项目后端数据库目标项目：

- Supabase URL: `https://jrzyddeijiltyruiawvc.supabase.co`
- Supabase project ref: `jrzyddeijiltyruiawvc`
- 业务数据库 provider: `supabase`

## 当前迁移边界

已纳入 Supabase Postgres 的后端数据模块：

- 用户管理：`users`、`user_sessions`、`project_members`
- 用户生产资产：`assets`、`asset_analyses`、`generated_images`、`storyboard_images`、`storyboard_videos`、`document_exports`
- 工作台业务 SQL：项目、阶段状态机、SOP 1-10、报价合同、客户审核、飞书交付、AI job、job events、AI task logs、审计日志
- Supabase 兼容层：`app_settings`、`set_updated_at()`、`updated_at` triggers、RLS 与 service role policy

## 目标到表的覆盖映射

| 目标 | Supabase 表 / 视图 |
| --- | --- |
| 用户管理系统 | `users`, `user_sessions`, `project_members`, `audit_logs` |
| 用户上传与生产资产 | `assets`, `asset_analyses`, `generated_images`, `storyboard_images`, `storyboard_videos`, `review_cuts`, `document_exports`, `artifacts`, `artifact_events`, `archive_records` |
| 后端工作台 SQL | `projects`, `project_stage_states`, `jobs`, `job_events`, `risk_check_cards`, `creative_directions`, `creative_expansions`, `creative_proposal_rounds`, `creative_scene_concepts`, `creative_scene_images`, `script_direction_packages`, `script_reference_assets`, `storyboard_scenes`, `storyboard_shots`, `storyboard_image_batches`, `storyboard_image_batch_items`, `storyboard_image_versions`, `storyboard_video_generation_inputs`, `workload_estimates`, `delivery_checklists`, `delivery_checklist_items`, `proposals`, `quotes`, `contracts`, `document_snapshots`, `client_review_tasks`, `client_review_items`, `review_cut_annotations`, `change_requests`, `production_entities`, `production_reference_sets`, `scoring_rules`, `scoring_rule_versions`, `material_embeddings`, `material_search_results`, `ai_task_logs` |
| 飞书交付状态 | `feishu_deliveries`, `project_feishu_receivers` |
| Supabase 迁移元数据与验收 | `app_settings`, `backend_migration_health` |
| 边缘函数和云函数 | 当前仓库没有独立函数源码；现有云端能力为 Next.js API routes + worker，状态统一落入 `jobs`, `job_events`, `ai_task_logs` 和业务产物表 |

当前仓库没有独立云函数或 Supabase Edge Function 源码需要搬迁。后端云能力仍由 Next.js API routes 和 `npm run worker` 承载；它们通过 `DATABASE_URL` 连接 Supabase Postgres。

## 必须补齐的本地值

`.env.local` 已写入 Supabase URL、Publishable Key、Service Role Key，并被 `.gitignore` 排除。它不会被提交到仓库。

还缺 Supabase 数据库密码，因此 `DATABASE_URL` 里仍有占位。应用会把这个占位连接串视为“未配置”，不会误报 ready：

```env
DATABASE_URL=PASTE_SUPABASE_POSTGRES_CONNECTION_STRING_HERE
```

请在 Supabase Dashboard 打开：

```text
Project Settings -> Database -> Connection string
```

复制 Transaction pooler 或 Session pooler 连接串，整条替换 `DATABASE_URL` 的占位值。不要猜 region/host，也不要使用 Supabase Service Role Key 作为数据库密码。

## 在 Supabase 执行 SQL

推荐执行文件：

```text
supabase/migrations/20260630000000_initial_backend_schema.sql
```

也可以在本地直接打印完整 SQL：

```bash
npm run --silent supabase:sql
```

执行前可以打印 SQL manifest，确认目标项目、SQL hash、业务表数量和 Supabase 元数据表：

```bash
npm run --silent supabase:sql:manifest
```

执行方式二选一：

1. Supabase Dashboard SQL Editor
   - 打开项目 `jrzyddeijiltyruiawvc`
   - 新建 query
   - 粘贴 `supabase/migrations/20260630000000_initial_backend_schema.sql` 全文
   - Run

2. Supabase CLI

```bash
supabase link --project-ref jrzyddeijiltyruiawvc
supabase db push
```

执行后可在 SQL Editor 验证：

```sql
select * from backend_migration_health;
select key, value_json from app_settings where key = 'database_provider';
```

也可以在本地用只读验收脚本检查 54 张业务表、RLS、`service_role` policy、`app_settings` 和健康视图：

```bash
npm run supabase:verify
```

## RLS 策略说明

迁移 SQL 会对业务表启用 RLS，并只给 `service_role` 开通全量策略。这样 Supabase Publishable Key 不能直接读写内部用户、资产、合同、飞书和 AI 任务表。

当前应用的权限边界仍在 Next.js API routes：

- session cookie 登录
- `requireUser`
- `requireProjectAccess`
- `requireRole`

如果未来要从浏览器直接调用 Supabase 表 API，需要先补精细 RLS 策略，不能直接给 `anon` 或 `authenticated` 授权核心表。

## 云函数/边缘函数

当前没有待迁移的函数源码。若后续新增 Supabase Edge Functions，请放在 `supabase/functions/<function-name>`，并用 Supabase Secrets 注入：

```bash
supabase secrets set \
  SUPABASE_URL="https://jrzyddeijiltyruiawvc.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<server-only-service-role-key>" \
  DATABASE_URL="<supabase-postgres-connection-string>"
```

不要把 Service Role Key、数据库密码、OSS、飞书或 AI provider 密钥写入源码。

## 切换后验证

补齐真实 Supabase `DATABASE_URL` 后运行：

```bash
npm run typecheck
npm run lint
npm run build
node --test --import tsx src/server/database/schema-sop-alignment.test.mjs
npm run supabase:verify
npm run user:create
```

`npm run user:create` 需要临时设置 `ADMIN_EMAIL`、`ADMIN_PASSWORD`、`ADMIN_NAME`、`ADMIN_ROLE`，用于在 Supabase 库创建首个管理员。
