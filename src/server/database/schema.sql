create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  password_hash text,
  role text not null check (role in ('business', 'creative', 'admin')),
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_sessions_token_hash_idx on user_sessions(token_hash);
create index if not exists user_sessions_user_id_idx on user_sessions(user_id);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null,
  project_name text not null,
  current_stage text not null default 'brand_requirement_intake',
  owner_id uuid references users(id),
  owner_name text not null,
  due_date date,
  status text not null default 'in_progress',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('business', 'creative', 'admin')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_id_idx on project_members(user_id);

create table if not exists project_stage_states (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_key text not null,
  status text not null,
  owner_name text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  retry_count integer not null default 0,
  input_refs jsonb not null default '[]'::jsonb,
  output_refs jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, stage_key)
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  uploaded_by uuid references users(id),
  asset_type text not null,
  source_type text not null default 'upload',
  oss_key text,
  oss_url text,
  external_url text,
  external_provider text,
  file_name text,
  file_size bigint,
  mime_type text,
  parse_status text not null default 'queued',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scoring_rules (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique,
  weight numeric not null default 1,
  description text not null default '',
  positive_examples jsonb not null default '[]'::jsonb,
  negative_examples jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  version integer not null default 1,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table scoring_rules
  add column if not exists version integer not null default 1;

create table if not exists scoring_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references scoring_rules(id) on delete cascade,
  version integer not null,
  tag text not null,
  weight numeric not null,
  description text not null default '',
  positive_examples jsonb not null default '[]'::jsonb,
  negative_examples jsonb not null default '[]'::jsonb,
  is_active boolean not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (rule_id, version)
);

create index if not exists scoring_rule_versions_rule_version_idx
  on scoring_rule_versions (rule_id, version desc);

insert into scoring_rule_versions (
  rule_id, version, tag, weight, description, positive_examples, negative_examples,
  is_active, created_by, created_at
)
select
  id, version, tag, weight, description, positive_examples, negative_examples,
  is_active, created_by, created_at
from scoring_rules
on conflict (rule_id, version) do nothing;

create table if not exists jobs (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  type text not null,
  status text not null check (status in ('queued', 'processing', 'succeeded', 'failed', 'retrying', 'cancelled')),
  title text not null,
  provider text,
  model_name text,
  input_json jsonb not null default '{}'::jsonb,
  current_step text,
  priority integer not null default 0,
  max_attempts integer not null default 2,
  available_at timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  retry_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_code text,
  user_message text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_queue_claim_idx
  on jobs (status, available_at, priority desc, created_at)
  where status in ('queued', 'retrying');

create index if not exists jobs_lock_expiry_idx
  on jobs (status, lock_expires_at)
  where status = 'processing';

create table if not exists asset_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  status text not null default 'draft',
  summary text not null default '',
  extracted_text text not null default '',
  labels_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  model_name text,
  source_job_id uuid references jobs(id),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id)
);

create table if not exists creative_directions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  core_idea text not null,
  fit_reason text not null,
  risk_notes text not null default '',
  reference_tags jsonb not null default '[]'::jsonb,
  score numeric not null default 0,
  cost_estimate text not null default '',
  cycle_estimate text not null default '',
  technical_difficulty text not null default '',
  atmosphere_prompt text not null default '',
  detail_json jsonb not null default '{}'::jsonb,
  is_selected boolean not null default false,
  selected_at timestamptz,
  status text not null default 'draft',
  sort_order integer not null default 0,
  source_job_id uuid references jobs(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_directions_project_active_idx
  on creative_directions (project_id, status, sort_order, updated_at desc);

create table if not exists creative_expansions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  direction_id uuid not null references creative_directions(id) on delete cascade,
  title text not null,
  one_liner text not null,
  story_arc_json jsonb not null default '{}'::jsonb,
  visual_highlights jsonb not null default '[]'::jsonb,
  visual_style text not null default '',
  production_difficulty text not null default '',
  risk_notes text not null default '',
  status text not null default 'draft',
  sort_order integer not null default 0,
  source_job_id uuid references jobs(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_expansions_direction_active_idx
  on creative_expansions (direction_id, status, sort_order, updated_at desc);

create table if not exists generated_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  direction_id uuid references creative_directions(id) on delete set null,
  expansion_id uuid references creative_expansions(id) on delete set null,
  prompt text not null,
  provider text not null,
  model_name text not null,
  status text not null default 'queued',
  oss_key text,
  oss_url text,
  failure_reason text,
  retry_count integer not null default 0,
  review_status text not null default 'pending',
  review_note text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  source_job_id uuid references jobs(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table generated_images
  add column if not exists review_status text not null default 'pending',
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references users(id),
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generated_images_review_status_check'
      and conrelid = 'generated_images'::regclass
  ) then
    alter table generated_images
      add constraint generated_images_review_status_check
      check (review_status in ('pending', 'confirmed', 'discarded'));
  end if;
end
$$;

create index if not exists generated_images_project_active_idx
  on generated_images (project_id, status, updated_at desc);

create index if not exists generated_images_expansion_idx
  on generated_images (expansion_id, updated_at desc);

create index if not exists generated_images_review_status_idx
  on generated_images (project_id, review_status, updated_at desc);

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  content text not null,
  status text not null default 'draft',
  version integer not null default 1,
  latest_snapshot_id uuid,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create index if not exists proposals_project_updated_idx
  on proposals (project_id, updated_at desc);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  currency text not null default 'CNY',
  items_json jsonb not null default '[]'::jsonb,
  notes text not null default '',
  total_amount numeric not null default 0,
  status text not null default 'draft',
  version integer not null default 1,
  latest_snapshot_id uuid,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create index if not exists quotes_project_updated_idx
  on quotes (project_id, updated_at desc);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  proposal_id uuid references proposals(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  client_contract_asset_id uuid references assets(id) on delete set null,
  title text not null,
  template_key text not null default 'default_aigc_video_contract',
  template_fields_json jsonb not null default '{}'::jsonb,
  content text not null,
  status text not null default 'draft',
  version integer not null default 1,
  latest_snapshot_id uuid,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create index if not exists contracts_project_updated_idx
  on contracts (project_id, updated_at desc);

create table if not exists document_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  document_type text not null,
  document_id uuid not null,
  title text not null,
  version integer not null,
  status text not null,
  content text not null,
  summary text not null default '',
  snapshot_json jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists document_snapshots_project_type_idx
  on document_snapshots (project_id, document_type, document_id, version desc, created_at desc);

create table if not exists document_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  document_type text not null,
  document_id uuid not null,
  snapshot_id uuid references document_snapshots(id) on delete set null,
  format text not null,
  title text not null,
  file_name text not null default '',
  mime_type text not null default '',
  file_size integer,
  status text not null default 'queued',
  oss_key text,
  oss_url text,
  source_job_id uuid references jobs(id),
  failure_reason text,
  retry_count integer not null default 0,
  version integer not null default 1,
  created_by uuid references users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_exports_project_type_idx
  on document_exports (project_id, document_type, updated_at desc);

create index if not exists document_exports_job_idx
  on document_exports (source_job_id);

create table if not exists feishu_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  document_type text not null check (document_type in ('proposal', 'quote', 'contract')),
  document_id uuid not null,
  snapshot_id uuid references document_snapshots(id) on delete set null,
  title text not null,
  content text not null default '',
  receiver_type text not null default 'chat' check (receiver_type in ('user', 'chat')),
  receiver_id text not null,
  receiver_name text not null default '',
  status text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed', 'retrying', 'cancelled')),
  feishu_document_token text,
  feishu_document_url text,
  feishu_message_id text,
  source_job_id uuid references jobs(id),
  failure_reason text,
  retry_count integer not null default 0,
  created_by uuid references users(id),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feishu_deliveries_project_idx
  on feishu_deliveries (project_id, updated_at desc);

create index if not exists feishu_deliveries_job_idx
  on feishu_deliveries (source_job_id);

create table if not exists project_feishu_receivers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  receiver_type text not null check (receiver_type in ('user', 'chat')),
  receiver_id text not null,
  display_name text not null default '',
  company_name text not null default '',
  contact_role text not null default '',
  contact_phone text,
  contact_email text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  last_delivery_id uuid references feishu_deliveries(id) on delete set null,
  last_sent_at timestamptz,
  failure_reason text,
  notes text not null default '',
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, receiver_type, receiver_id)
);

create index if not exists project_feishu_receivers_project_idx
  on project_feishu_receivers (project_id, is_active, updated_at desc);

alter table feishu_deliveries
  add column if not exists receiver_ref_id uuid references project_feishu_receivers(id) on delete set null;

create table if not exists material_embeddings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  asset_analysis_id uuid not null references asset_analyses(id) on delete cascade,
  content_text text not null,
  labels_json jsonb not null default '[]'::jsonb,
  provider text not null,
  model_name text not null,
  content_hash text not null,
  embedding_json jsonb not null default '[]'::jsonb,
  status text not null default 'succeeded',
  failure_reason text,
  source_job_id uuid references jobs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_analysis_id, model_name, content_hash)
);

create index if not exists material_embeddings_project_idx
  on material_embeddings (project_id, updated_at desc);

create table if not exists material_search_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  query_text text not null,
  provider text not null,
  model_name text not null,
  results_json jsonb not null default '[]'::jsonb,
  source_job_id uuid references jobs(id),
  created_at timestamptz not null default now()
);

create index if not exists material_search_results_project_idx
  on material_search_results (project_id, created_at desc);

create table if not exists ai_task_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  call_id text not null,
  provider text not null,
  model_name text not null,
  operation text not null,
  status text not null check (status in ('succeeded', 'failed')),
  provider_request_id text,
  provider_response_id text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  input_chars integer,
  output_chars integer,
  image_count integer,
  embedding_dimensions integer,
  duration_ms integer not null,
  attempt integer not null default 1,
  error_code text,
  error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_task_logs_project_created_idx
  on ai_task_logs (project_id, created_at desc);

create index if not exists ai_task_logs_job_created_idx
  on ai_task_logs (job_id, created_at desc);

create sequence if not exists job_events_sequence;

create table if not exists job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  project_id uuid generated always as ((payload_json->>'projectId')::uuid) stored,
  sequence bigint not null default nextval('job_events_sequence'),
  type text not null,
  payload_json jsonb not null,
  user_message text,
  created_at timestamptz not null default now()
);

create index if not exists job_events_job_sequence_idx on job_events(job_id, sequence);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null,
  title text not null,
  status text not null default 'draft',
  data_json jsonb not null default '{}'::jsonb,
  oss_url text,
  source_job_id uuid references jobs(id),
  version integer not null default 1,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artifact_events (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  job_id uuid references jobs(id),
  type text not null,
  patch_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  project_id uuid references projects(id) on delete set null,
  action text not null,
  object_type text not null,
  object_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists audit_logs_created_idx
  on audit_logs (created_at desc);

create index if not exists audit_logs_project_created_idx
  on audit_logs (project_id, created_at desc);

create index if not exists audit_logs_actor_created_idx
  on audit_logs (actor_id, created_at desc);

create index if not exists audit_logs_action_created_idx
  on audit_logs (action, created_at desc);
