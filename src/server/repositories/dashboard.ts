import type { ProjectStage, Role, StageStatus } from "@/domain/types";
import { query } from "@/lib/db";
import type { AuthUser } from "@/server/repositories/users";

export type DashboardTone = "neutral" | "success" | "warning" | "danger";

export type DashboardCard = {
  key: string;
  title: string;
  value: number;
  detail: string;
  tone: DashboardTone;
};

export type DashboardTask = {
  id: string;
  title: string;
  detail: string;
  projectId: string | null;
  projectLabel: string | null;
  status: string;
  priority: "normal" | "warning" | "urgent";
  updatedAt: string | null;
};

export type DashboardSection = {
  key: string;
  title: string;
  description: string;
  emptyMessage: string;
  items: DashboardTask[];
};

export type DashboardProject = {
  id: string;
  brandName: string;
  projectName: string;
  currentStage: ProjectStage;
  status: StageStatus;
  ownerName: string;
  dueDate: string | null;
  updatedAt: string;
};

export type RoleDashboardView = {
  role: Role;
  generatedAt: string;
  cards: DashboardCard[];
  sections: DashboardSection[];
  recentProjects: DashboardProject[];
};

type CountRow = Record<string, string | number>;

type TaskRow = {
  id: string;
  title: string;
  detail: string;
  project_id: string | null;
  project_label: string | null;
  status: string;
  priority: "normal" | "warning" | "urgent";
  updated_at: string | null;
};

type ProjectRow = {
  id: string;
  brand_name: string;
  project_name: string;
  current_stage: ProjectStage;
  status: StageStatus;
  owner_name: string;
  due_date: string | null;
  updated_at: string;
};

export async function getRoleDashboard(user: AuthUser): Promise<RoleDashboardView> {
  const [cards, sections, recentProjects] = await Promise.all([
    getDashboardCards(user),
    getDashboardSections(user),
    listRecentDashboardProjects(user),
  ]);

  return {
    role: user.role,
    generatedAt: new Date().toISOString(),
    cards,
    sections,
    recentProjects,
  };
}

async function getDashboardCards(user: AuthUser): Promise<DashboardCard[]> {
  if (user.role === "business") return getBusinessCards(user);
  if (user.role === "creative") return getCreativeCards(user);
  return getAdminCards(user);
}

async function getDashboardSections(user: AuthUser): Promise<DashboardSection[]> {
  if (user.role === "business") {
    const [requirements, quoteContracts, feishu] = await Promise.all([
      listBusinessRequirementTasks(user),
      listBusinessQuoteContractTasks(user),
      listBusinessFeishuTasks(user),
    ]);
    return [
      {
        key: "business_requirements",
        title: "待补充需求",
        description: "来自品牌需求阶段状态和客户资料解析结果。",
        emptyMessage: "当前没有需要补充的客户需求。",
        items: requirements,
      },
      {
        key: "business_quote_contract",
        title: "待确认报价 / 合同",
        description: "报价、合同草稿、审核和签约状态。",
        emptyMessage: "当前没有待处理的报价或合同。",
        items: quoteContracts,
      },
      {
        key: "business_feishu",
        title: "待飞书交付",
        description: "已具备快照但还没有成功发送的材料。",
        emptyMessage: "当前没有待发送的飞书交付。",
        items: feishu,
      },
    ];
  }

  if (user.role === "creative") {
    const [creativeEval, deepening, atmosphere] = await Promise.all([
      listCreativeEvaluationTasks(user),
      listCreativeDeepeningTasks(user),
      listCreativeAtmosphereTasks(user),
    ]);
    return [
      {
        key: "creative_evaluation",
        title: "待创意评估",
        description: "已解析资料但还没形成 Top 5 创意方向的项目。",
        emptyMessage: "当前没有待创意评估项目。",
        items: creativeEval,
      },
      {
        key: "creative_deepening",
        title: "待深化方向",
        description: "已选中但还未生成故事大纲的创意方向。",
        emptyMessage: "当前没有待深化方向。",
        items: deepening,
      },
      {
        key: "creative_atmosphere",
        title: "待生成 / 确认氛围图",
        description: "故事大纲缺少成功氛围图，或成功氛围图仍待人工确认。",
        emptyMessage: "当前没有待处理氛围图。",
        items: atmosphere,
      },
    ];
  }

  const [blocked, failedJobs, governance] = await Promise.all([
    listAdminBlockedTasks(user),
    listAdminFailedJobTasks(user),
    listAdminGovernanceTasks(),
  ]);
  return [
    {
      key: "admin_blocked",
      title: "阻塞项目",
      description: "来自项目状态机和阶段错误原因。",
      emptyMessage: "当前没有阻塞项目。",
      items: blocked,
    },
    {
      key: "admin_failed_jobs",
      title: "异常任务",
      description: "失败或等待重试的后台任务。",
      emptyMessage: "当前没有异常任务。",
      items: failedJobs,
    },
    {
      key: "admin_governance",
      title: "治理待办",
      description: "评分规则、成员和交付配置的管理项。",
      emptyMessage: "治理项状态正常。",
      items: governance,
    },
  ];
}

async function getBusinessCards(user: AuthUser): Promise<DashboardCard[]> {
  const result = await query<CountRow>(
    `${accessibleProjectCte}
     select
       count(*) filter (where p.current_stage = 'brand_requirement_intake' or p.status in ('needs_revision', 'blocked'))::text as requirement_count,
       count(*) filter (where p.current_stage = 'selection_quote_contract')::text as contract_count,
       count(*) filter (
         where c.latest_snapshot_id is not null
           and not exists (
             select 1 from feishu_deliveries fd
             where fd.project_id = p.id and fd.status = 'succeeded'
           )
       )::text as feishu_count
     from accessible_projects p
     left join contracts c on c.project_id = p.id`,
    accessParams(user)
  );
  const row = result.rows[0] ?? {};
  return [
    makeCard("requirement", "待补充需求", Number(row.requirement_count ?? 0), "需求阶段、需修改或阻塞项目", "warning"),
    makeCard("contract", "待确认报价/合同", Number(row.contract_count ?? 0), "处于报价签约阶段的项目", "neutral"),
    makeCard("feishu", "待飞书发送", Number(row.feishu_count ?? 0), "已有合同快照但未成功交付", "danger"),
  ];
}

async function getCreativeCards(user: AuthUser): Promise<DashboardCard[]> {
  const result = await query<CountRow>(
    `${accessibleProjectCte}
     select
       count(distinct p.id) filter (where aa.id is not null and cd.id is null)::text as evaluation_count,
       count(distinct cd.id) filter (where cd.is_selected = true and ce.id is null)::text as deepening_count,
       (
         count(distinct ce.id) filter (where gi.id is null)
         + count(distinct gi.id) filter (where gi.review_status = 'pending')
       )::text as atmosphere_count
     from accessible_projects p
     left join asset_analyses aa on aa.project_id = p.id and aa.status = 'succeeded'
     left join creative_directions cd on cd.project_id = p.id and cd.status <> 'archived'
     left join creative_expansions ce on ce.direction_id = cd.id and ce.status <> 'archived'
     left join generated_images gi on gi.expansion_id = ce.id and gi.status = 'succeeded'`,
    accessParams(user)
  );
  const row = result.rows[0] ?? {};
  return [
    makeCard("evaluation", "待创意评估", Number(row.evaluation_count ?? 0), "资料已解析但缺少 Top 5", "warning"),
    makeCard("deepening", "待深化方向", Number(row.deepening_count ?? 0), "已选中但缺故事大纲", "neutral"),
    makeCard("atmosphere", "待处理氛围图", Number(row.atmosphere_count ?? 0), "缺少成功图或待人工确认", "danger"),
  ];
}

async function getAdminCards(user: AuthUser): Promise<DashboardCard[]> {
  const result = await query<CountRow>(
    `${accessibleProjectCte}
     select
       count(distinct p.id) filter (where p.status = 'blocked' or pss.status = 'blocked')::text as blocked_count,
       (select count(*) from jobs where status in ('failed', 'retrying'))::text as failed_job_count,
       (select count(*) from scoring_rules where is_active = true)::text as active_rule_count,
       (select count(*) from users where is_active = true)::text as user_count
     from accessible_projects p
     left join project_stage_states pss on pss.project_id = p.id`,
    accessParams(user)
  );
  const row = result.rows[0] ?? {};
  return [
    makeCard("blocked", "阻塞项目", Number(row.blocked_count ?? 0), "状态机 blocked 项目", "danger"),
    makeCard("jobs", "异常任务", Number(row.failed_job_count ?? 0), "失败或等待重试的 worker 任务", "warning"),
    makeCard("rules", "评分规则", Number(row.active_rule_count ?? 0), `活跃成员 ${Number(row.user_count ?? 0)} 人`, "success"),
  ];
}

async function listBusinessRequirementTasks(user: AuthUser) {
  const result = await query<TaskRow>(
    `${accessibleProjectCte}
     select
       p.id || ':requirement' as id,
       p.brand_name || ' / ' || p.project_name as project_label,
       p.id as project_id,
       '补齐客户需求与资料' as title,
       coalesce(pss.error_message, '当前阶段：' || p.current_stage || '，状态：' || p.status) as detail,
       coalesce(pss.status, p.status) as status,
       case when coalesce(pss.status, p.status) in ('blocked', 'needs_revision') then 'urgent' else 'normal' end as priority,
       coalesce(pss.updated_at, p.updated_at)::text as updated_at
     from accessible_projects p
     left join project_stage_states pss on pss.project_id = p.id and pss.stage_key = 'brand_requirement_intake'
     where p.current_stage = 'brand_requirement_intake'
        or p.status in ('needs_revision', 'blocked')
        or pss.status in ('needs_revision', 'blocked')
     order by coalesce(pss.updated_at, p.updated_at) desc
     limit 8`,
    accessParams(user)
  );
  return result.rows.map(mapTask);
}

async function listBusinessQuoteContractTasks(user: AuthUser) {
  const result = await query<TaskRow>(
    `${accessibleProjectCte}
     select
       p.id || ':quote_contract' as id,
       p.brand_name || ' / ' || p.project_name as project_label,
       p.id as project_id,
       case when c.id is null then '创建合同快照'
            when c.status in ('needs_revision', 'draft') then '修改合同'
            else '确认报价与合同' end as title,
       '报价：' || coalesce(q.status, '未创建') || '；合同：' || coalesce(c.status, '未创建') as detail,
       coalesce(c.status, q.status, p.status) as status,
       case when coalesce(c.status, q.status) = 'needs_revision' then 'urgent' else 'normal' end as priority,
       greatest(coalesce(c.updated_at, p.updated_at), coalesce(q.updated_at, p.updated_at))::text as updated_at
     from accessible_projects p
     left join quotes q on q.project_id = p.id
     left join contracts c on c.project_id = p.id
     where p.current_stage = 'selection_quote_contract'
        or q.status in ('draft', 'waiting_review', 'needs_revision', 'confirmed')
        or c.status in ('draft', 'waiting_review', 'needs_revision', 'confirmed')
     order by greatest(coalesce(c.updated_at, p.updated_at), coalesce(q.updated_at, p.updated_at)) desc
     limit 8`,
    accessParams(user)
  );
  return result.rows.map(mapTask);
}

async function listBusinessFeishuTasks(user: AuthUser) {
  const result = await query<TaskRow>(
    `${accessibleProjectCte}
     select
       p.id || ':feishu' as id,
       p.brand_name || ' / ' || p.project_name as project_label,
       p.id as project_id,
       case when fd.status = 'failed' then '重试飞书交付' else '发送飞书交付' end as title,
       case when fd.failure_reason is not null then fd.failure_reason
            else '合同已保存快照，但还没有成功飞书交付记录' end as detail,
       coalesce(fd.status, 'not_sent') as status,
       case when fd.status = 'failed' then 'urgent' else 'warning' end as priority,
       coalesce(fd.updated_at, c.updated_at, p.updated_at)::text as updated_at
     from accessible_projects p
     join contracts c on c.project_id = p.id and c.latest_snapshot_id is not null
     left join lateral (
       select status, failure_reason, updated_at
       from feishu_deliveries
       where project_id = p.id
       order by updated_at desc
       limit 1
     ) fd on true
     where not exists (
       select 1 from feishu_deliveries ok
       where ok.project_id = p.id and ok.status = 'succeeded'
     )
     order by coalesce(fd.updated_at, c.updated_at, p.updated_at) desc
     limit 8`,
    accessParams(user)
  );
  return result.rows.map(mapTask);
}

async function listCreativeEvaluationTasks(user: AuthUser) {
  const result = await query<TaskRow>(
    `${accessibleProjectCte}
     select
       p.id || ':creative_eval' as id,
       p.brand_name || ' / ' || p.project_name as project_label,
       p.id as project_id,
       '生成 Top 5 创意方向' as title,
       '已解析资料 ' || count(aa.id)::text || ' 条，等待形成创意方向' as detail,
       p.status as status,
       'warning' as priority,
       max(aa.updated_at)::text as updated_at
     from accessible_projects p
     join asset_analyses aa on aa.project_id = p.id and aa.status = 'succeeded'
     left join creative_directions cd on cd.project_id = p.id and cd.status <> 'archived'
     where cd.id is null
     group by p.id, p.brand_name, p.project_name, p.status
     order by max(aa.updated_at) desc
     limit 8`,
    accessParams(user)
  );
  return result.rows.map(mapTask);
}

async function listCreativeDeepeningTasks(user: AuthUser) {
  const result = await query<TaskRow>(
    `${accessibleProjectCte}
     select
       cd.id || ':deepening' as id,
       p.brand_name || ' / ' || p.project_name as project_label,
       p.id as project_id,
       '深化方向：' || cd.title as title,
       '已选中方向，等待生成 4-5 个故事大纲或梗概' as detail,
       cd.status as status,
       'normal' as priority,
       cd.updated_at::text as updated_at
     from accessible_projects p
     join creative_directions cd on cd.project_id = p.id and cd.is_selected = true and cd.status <> 'archived'
     left join creative_expansions ce on ce.direction_id = cd.id and ce.status <> 'archived'
     where ce.id is null
     order by cd.updated_at desc
     limit 8`,
    accessParams(user)
  );
  return result.rows.map(mapTask);
}

async function listCreativeAtmosphereTasks(user: AuthUser) {
  const missingImageResult = await query<TaskRow>(
    `${accessibleProjectCte}
     select
       ce.id || ':atmosphere' as id,
       p.brand_name || ' / ' || p.project_name as project_label,
       p.id as project_id,
       '生成氛围图：' || ce.title as title,
       '故事大纲已存在，等待成功氛围图' as detail,
       ce.status as status,
       'warning' as priority,
       ce.updated_at::text as updated_at
     from accessible_projects p
     join creative_expansions ce on ce.project_id = p.id and ce.status <> 'archived'
     left join generated_images gi on gi.expansion_id = ce.id and gi.status = 'succeeded'
     where gi.id is null
     order by ce.updated_at desc
     limit 4`,
    accessParams(user)
  );

  const pendingReviewResult = await query<TaskRow>(
    `${accessibleProjectCte}
     select
       gi.id || ':image_review' as id,
       p.brand_name || ' / ' || p.project_name as project_label,
       p.id as project_id,
       '确认氛围图：' || coalesce(ce.title, cd.title, '待命名氛围图') as title,
       '氛围图已生成成功，等待人工确认采用或废弃' as detail,
       gi.review_status as status,
       'normal' as priority,
       gi.updated_at::text as updated_at
     from accessible_projects p
     join generated_images gi on gi.project_id = p.id and gi.status = 'succeeded' and gi.review_status = 'pending'
     left join creative_expansions ce on ce.id = gi.expansion_id
     left join creative_directions cd on cd.id = gi.direction_id
     order by gi.updated_at desc
     limit 4`,
    accessParams(user)
  );

  return [...missingImageResult.rows, ...pendingReviewResult.rows]
    .sort((left, right) => parseTaskTime(right.updated_at) - parseTaskTime(left.updated_at))
    .slice(0, 8)
    .map(mapTask);
}

function parseTaskTime(value: string | null) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : 0;
}

async function listAdminBlockedTasks(user: AuthUser) {
  const result = await query<TaskRow>(
    `${accessibleProjectCte}
     select distinct on (p.id)
       p.id || ':blocked' as id,
       p.brand_name || ' / ' || p.project_name as project_label,
       p.id as project_id,
       '处理阻塞项目' as title,
       coalesce(pss.error_message, '项目状态为 blocked，需要管理员介入') as detail,
       coalesce(pss.status, p.status) as status,
       'urgent' as priority,
       coalesce(pss.updated_at, p.updated_at)::text as updated_at
     from accessible_projects p
     left join project_stage_states pss on pss.project_id = p.id and pss.status = 'blocked'
     where p.status = 'blocked' or pss.status = 'blocked'
     order by p.id, coalesce(pss.updated_at, p.updated_at) desc
     limit 8`,
    accessParams(user)
  );
  return result.rows.map(mapTask);
}

async function listAdminFailedJobTasks(user: AuthUser) {
  const result = await query<TaskRow>(
    `${accessibleProjectCte}
     select
       j.id as id,
       p.brand_name || ' / ' || p.project_name as project_label,
       p.id as project_id,
       '任务异常：' || j.title as title,
       coalesce(j.user_message, '后台任务失败或等待重试') as detail,
       j.status as status,
       case when j.status = 'failed' then 'urgent' else 'warning' end as priority,
       j.updated_at::text as updated_at
     from accessible_projects p
     join jobs j on j.project_id = p.id
     where j.status in ('failed', 'retrying')
     order by j.updated_at desc
     limit 8`,
    accessParams(user)
  );
  return result.rows.map(mapTask);
}

async function listAdminGovernanceTasks() {
  const result = await query<TaskRow>(
    `select
       'scoring_rules' as id,
       null::text as project_label,
       null::uuid as project_id,
       case when count(*) = 0 then '配置评分规则' else '复核评分规则' end as title,
       '当前活跃评分规则 ' || count(*)::text || ' 条' as detail,
       case when count(*) = 0 then 'needs_revision' else 'in_progress' end as status,
       case when count(*) = 0 then 'urgent' else 'normal' end as priority,
       max(updated_at)::text as updated_at
     from scoring_rules
     where is_active = true`
  );
  return result.rows.map(mapTask);
}

async function listRecentDashboardProjects(user: AuthUser) {
  const result = await query<ProjectRow>(
    `${accessibleProjectCte}
     select id, brand_name, project_name, current_stage, status, owner_name, due_date, updated_at
     from accessible_projects
     order by updated_at desc
     limit 6`,
    accessParams(user)
  );

  return result.rows.map((row) => ({
    id: row.id,
    brandName: row.brand_name,
    projectName: row.project_name,
    currentStage: row.current_stage,
    status: row.status,
    ownerName: row.owner_name,
    dueDate: row.due_date,
    updatedAt: row.updated_at,
  }));
}

const accessibleProjectCte = `
  with accessible_projects as (
    select p.*
    from projects p
    where p.archived_at is null
      and (
        $1::text = 'admin'
        or exists (
          select 1
          from project_members pm
          where pm.project_id = p.id and pm.user_id = $2::uuid
        )
      )
  )`;

function accessParams(user: AuthUser) {
  return [user.role, user.id];
}

function makeCard(key: string, title: string, value: number, detail: string, tone: DashboardTone): DashboardCard {
  return { key, title, value, detail, tone };
}

function mapTask(row: TaskRow): DashboardTask {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    projectId: row.project_id,
    projectLabel: row.project_label,
    status: row.status,
    priority: row.priority,
    updatedAt: row.updated_at,
  };
}
