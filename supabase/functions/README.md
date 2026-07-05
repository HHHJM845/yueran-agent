# Supabase Edge Functions

当前项目没有独立的 Supabase Edge Function 代码需要迁移。

生产后端能力仍由 Next.js API routes 和独立 worker 承载：

- Web/API：`npm run start`
- 后台任务 worker：`npm run worker`
- 队列、任务事件、AI 调用日志、用户、资产和业务产物统一落在 Supabase Postgres

如果后续要把某个云函数迁入 Supabase，请在本目录按函数名单独建目录，并通过 Supabase Secrets 注入服务端密钥：

```bash
supabase secrets set \
  SUPABASE_URL="https://jrzyddeijiltyruiawvc.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<server-only-service-role-key>" \
  DATABASE_URL="<supabase-postgres-connection-string>"
```

不要把 Service Role Key、数据库密码、OSS 密钥、飞书密钥或 AI provider key 写入函数源码。
