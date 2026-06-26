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

do $$
begin
  insert into project_stage_states (
    project_id, stage_key, status, owner_name, started_at, completed_at,
    error_message, retry_count, input_refs, output_refs, snapshot, created_at, updated_at
  )
  select distinct on (project_id)
    project_id, 'script_storyboard_confirmation', status, owner_name, started_at, completed_at,
    error_message, retry_count, input_refs, output_refs, snapshot, created_at, now()
  from project_stage_states
  where stage_key in ('full_script_deepening', 'visual_design', 'text_storyboard')
  order by project_id, updated_at desc
  on conflict (project_id, stage_key) do nothing;

  insert into project_stage_states (
    project_id, stage_key, status, owner_name, started_at, completed_at,
    error_message, retry_count, input_refs, output_refs, snapshot, created_at, updated_at
  )
  select distinct on (project_id)
    project_id, 'storyboard_image_canvas', status, owner_name, started_at, completed_at,
    error_message, retry_count, input_refs, output_refs, snapshot, created_at, now()
  from project_stage_states
  where stage_key = 'storyboard_image_generation'
  order by project_id, updated_at desc
  on conflict (project_id, stage_key) do nothing;

  insert into project_stage_states (
    project_id, stage_key, status, owner_name, started_at, completed_at,
    error_message, retry_count, input_refs, output_refs, snapshot, created_at, updated_at
  )
  select distinct on (project_id)
    project_id, 'ai_video_canvas', status, owner_name, started_at, completed_at,
    error_message, retry_count, input_refs, output_refs, snapshot, created_at, now()
  from project_stage_states
  where stage_key = 'video_generation_selection'
  order by project_id, updated_at desc
  on conflict (project_id, stage_key) do nothing;

  delete from project_stage_states
   where stage_key in ('full_script_deepening', 'visual_design', 'text_storyboard', 'storyboard_image_generation', 'video_generation_selection');

  update projects
     set current_stage = case
       when current_stage in ('full_script_deepening', 'visual_design', 'text_storyboard') then 'script_storyboard_confirmation'
       when current_stage = 'storyboard_image_generation' then 'storyboard_image_canvas'
       when current_stage = 'video_generation_selection' then 'ai_video_canvas'
       else current_stage
     end,
     updated_at = now()
   where current_stage in ('full_script_deepening', 'visual_design', 'text_storyboard', 'storyboard_image_generation', 'video_generation_selection');
end
$$;

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

create table if not exists script_direction_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  direction_id uuid references creative_directions(id) on delete set null,
  title text not null,
  concept text not null default '',
  full_script text not null default '',
  status text not null default 'draft' check (status in ('draft', 'internal_review', 'client_reviewing', 'client_approved', 'client_rejected', 'locked', 'archived')),
  version integer not null default 1,
  selected_at timestamptz,
  locked_at timestamptz,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists script_direction_packages_project_idx
  on script_direction_packages (project_id, status, updated_at desc);

create table if not exists script_reference_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  package_id uuid not null references script_direction_packages(id) on delete cascade,
  reference_type text not null check (reference_type in ('character', 'scene')),
  title text not null,
  style_label text not null default '',
  prompt text not null default '',
  asset_id uuid references assets(id) on delete set null,
  generated_image_id uuid references generated_images(id) on delete set null,
  oss_url text,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'selected', 'discarded', 'locked')),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists script_reference_assets_package_idx
  on script_reference_assets (package_id, reference_type, sort_order, updated_at desc);

create table if not exists storyboard_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  package_id uuid references script_direction_packages(id) on delete set null,
  scene_number integer not null,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'image_generating', 'internal_review', 'ready_for_client_review', 'client_reviewing', 'client_approved', 'client_rejected', 'revision_required', 'locked', 'video_generating', 'video_internal_review', 'video_confirmed')),
  locked_version integer,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, scene_number)
);

create index if not exists storyboard_scenes_project_idx
  on storyboard_scenes (project_id, scene_number, updated_at desc);

create table if not exists storyboard_shots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  scene_id uuid not null references storyboard_scenes(id) on delete cascade,
  package_id uuid references script_direction_packages(id) on delete set null,
  shot_number text not null,
  visual_description text not null,
  shot_size text not null default '',
  action_expression text not null default '',
  camera_movement text not null default '',
  duration_seconds numeric,
  sound_transition text not null default '',
  notes text not null default '',
  character_refs jsonb not null default '[]'::jsonb,
  scene_refs jsonb not null default '[]'::jsonb,
  image_prompt text not null default '',
  video_prompt text not null default '',
  status text not null default 'draft' check (status in ('draft', 'internal_review', 'client_reviewing', 'client_approved', 'client_rejected', 'image_generating', 'image_ready', 'image_selected', 'video_generating', 'video_ready', 'video_selected', 'locked')),
  version integer not null default 1,
  sort_order integer not null default 0,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storyboard_shots_scene_idx
  on storyboard_shots (scene_id, sort_order, updated_at desc);

create table if not exists storyboard_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  scene_id uuid not null references storyboard_scenes(id) on delete cascade,
  shot_id uuid not null references storyboard_shots(id) on delete cascade,
  prompt text not null,
  provider text not null,
  model_name text not null,
  generation_status text not null default 'queued' check (generation_status in ('queued', 'processing', 'succeeded', 'failed', 'retrying', 'cancelled')),
  oss_key text,
  oss_url text,
  asset_id uuid references assets(id) on delete set null,
  is_selected boolean not null default false,
  internal_review_status text not null default 'pending' check (internal_review_status in ('pending', 'confirmed', 'discarded', 'needs_revision')),
  failure_reason text,
  retry_count integer not null default 0,
  annotations_json jsonb not null default '[]'::jsonb,
  reference_json jsonb not null default '{}'::jsonb,
  source_job_id uuid references jobs(id),
  version integer not null default 1,
  created_by uuid references users(id),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storyboard_images_shot_idx
  on storyboard_images (shot_id, is_selected, updated_at desc);

create table if not exists storyboard_videos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  scene_id uuid not null references storyboard_scenes(id) on delete cascade,
  shot_id uuid not null references storyboard_shots(id) on delete cascade,
  image_id uuid references storyboard_images(id) on delete set null,
  prompt text not null,
  provider text not null,
  model_name text not null,
  generation_status text not null default 'queued' check (generation_status in ('queued', 'processing', 'succeeded', 'failed', 'retrying', 'cancelled')),
  oss_key text,
  oss_url text,
  asset_id uuid references assets(id) on delete set null,
  is_selected boolean not null default false,
  internal_review_status text not null default 'pending' check (internal_review_status in ('pending', 'confirmed', 'discarded', 'needs_revision')),
  failure_reason text,
  retry_count integer not null default 0,
  source_job_id uuid references jobs(id),
  version integer not null default 1,
  created_by uuid references users(id),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storyboard_videos_shot_idx
  on storyboard_videos (shot_id, is_selected, updated_at desc);

create table if not exists review_cuts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  cut_type text not null check (cut_type in ('a_copy', 'b_copy')),
  title text not null,
  description text not null default '',
  asset_id uuid references assets(id) on delete set null,
  video_url text,
  duration_seconds numeric,
  status text not null default 'uploaded' check (status in ('uploaded', 'internal_review', 'internal_approved', 'client_reviewing', 'client_approved', 'client_rejected', 'revision_required', 'archived')),
  version integer not null default 1,
  client_review_task_id uuid,
  created_by uuid references users(id),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_cuts_project_type_idx
  on review_cuts (project_id, cut_type, version desc, updated_at desc);

create table if not exists client_review_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  module_key text not null,
  review_type text not null check (review_type in ('brief_confirmation', 'project_proposal', 'quote_confirmation', 'contract_confirmation', 'script_package', 'storyboard_scene_images', 'a_copy_review', 'b_copy_review')),
  target_scope_type text not null check (target_scope_type in ('project', 'proposal', 'quote', 'contract', 'script_package', 'storyboard_scene', 'review_cut')),
  target_scope_id uuid not null,
  title text not null,
  summary text not null default '',
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'active', 'submitted', 'approved', 'rejected', 'expired', 'revoked')),
  access_token_hash text not null unique,
  verification_code_hash text not null,
  expires_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  payload_json jsonb not null default '{}'::jsonb,
  decision_payload_json jsonb not null default '{}'::jsonb,
  reviewer_name text,
  reviewer_contact text,
  feedback text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_review_tasks_project_idx
  on client_review_tasks (project_id, review_type, target_scope_id, version desc, updated_at desc);

create table if not exists client_review_items (
  id uuid primary key default gen_random_uuid(),
  review_task_id uuid not null references client_review_tasks(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  item_type text not null check (item_type in ('brief', 'proposal', 'quote', 'contract', 'script_direction', 'reference_asset', 'storyboard_shot_image', 'review_cut_video')),
  item_id uuid not null,
  item_label text not null default '',
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'rejected')),
  score integer check (score is null or (score >= 1 and score <= 5)),
  feedback text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_review_items_task_idx
  on client_review_items (review_task_id, item_type, updated_at desc);

create table if not exists review_cut_annotations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  review_cut_id uuid not null references review_cuts(id) on delete cascade,
  review_task_id uuid references client_review_tasks(id) on delete set null,
  time_seconds numeric not null,
  feedback text not null default '',
  mapped_scene_id uuid references storyboard_scenes(id) on delete set null,
  mapped_shot_id uuid references storyboard_shots(id) on delete set null,
  mapping_confidence numeric,
  status text not null default 'needs_triage' check (status in ('needs_triage', 'mapped', 'regenerating', 'resolved', 'dismissed')),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_cut_annotations_cut_idx
  on review_cut_annotations (review_cut_id, time_seconds, created_at desc);

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

alter table client_review_tasks
  add column if not exists sop_key text,
  add column if not exists review_scene text,
  add column if not exists round_number integer,
  add column if not exists batch_number integer,
  add column if not exists review_payload_version integer not null default 1;

alter table client_review_items
  add column if not exists target_kind text,
  add column if not exists target_version integer,
  add column if not exists feedback_payload_json jsonb not null default '{}'::jsonb;

alter table review_cuts
  add column if not exists round_number integer not null default 1,
  add column if not exists snapshot_json jsonb not null default '{}'::jsonb,
  add column if not exists change_request_hint text;

create table if not exists risk_check_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'needs_revision', 'approved', 'archived')),
  overall_alert text not null default 'low' check (overall_alert in ('low', 'medium', 'high', 'redline')),
  human_decision text check (human_decision is null or human_decision in ('accept', 'reject', 'conditional_accept')),
  decision_reason text not null default '',
  decided_by uuid references users(id),
  decided_at timestamptz,
  source_artifact_id uuid references artifacts(id) on delete set null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create table if not exists risk_check_facts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  card_id uuid not null references risk_check_cards(id) on delete cascade,
  field_key text not null,
  field_label text not null default '',
  value_json jsonb not null default '{}'::jsonb,
  evidence text not null default '',
  confidence numeric not null default 0,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, field_key)
);

create table if not exists risk_check_dimensions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  card_id uuid not null references risk_check_cards(id) on delete cascade,
  dimension_key text not null,
  level text not null check (level in ('low', 'medium', 'high')),
  evidence text not null default '',
  anchor_text text not null default '',
  confidence numeric not null default 0,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, dimension_key)
);

create table if not exists creative_proposal_rounds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  round_number integer not null check (round_number in (1, 2)),
  status text not null default 'draft' check (status in ('draft', 'generating', 'internal_review', 'client_reviewing', 'client_rejected', 'client_approved', 'locked', 'archived')),
  version integer not null default 1,
  direction_ids jsonb not null default '[]'::jsonb,
  retained_direction_ids jsonb not null default '[]'::jsonb,
  client_feedback_json jsonb not null default '{}'::jsonb,
  client_review_task_id uuid references client_review_tasks(id) on delete set null,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, round_number, version)
);

create table if not exists creative_scene_concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  round_id uuid not null references creative_proposal_rounds(id) on delete cascade,
  direction_id uuid references creative_directions(id) on delete set null,
  scene_index integer not null,
  title text not null,
  description text not null default '',
  source_text text not null default '',
  image_prompt text not null default '',
  required_image_count integer not null default 4,
  selected_image_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'selected', 'discarded', 'client_commented')),
  version integer not null default 1,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creative_scene_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  round_id uuid not null references creative_proposal_rounds(id) on delete cascade,
  scene_concept_id uuid not null references creative_scene_concepts(id) on delete cascade,
  generated_image_id uuid references generated_images(id) on delete set null,
  asset_id uuid references assets(id) on delete set null,
  oss_url text,
  prompt text not null default '',
  status text not null default 'generated' check (status in ('queued', 'generated', 'failed', 'selected', 'discarded')),
  is_selected boolean not null default false,
  sort_order integer not null default 0,
  failure_reason text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workload_estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'generated', 'confirmed', 'archived')),
  role_count integer not null default 0,
  scene_count integer not null default 0,
  shot_count integer not null default 0,
  image_count integer not null default 0,
  video_count integer not null default 0,
  revision_rounds integer not null default 0,
  deliverable_versions jsonb not null default '[]'::jsonb,
  complexity text not null default 'medium' check (complexity in ('low', 'medium', 'high')),
  min_price_cny numeric not null default 0,
  max_price_cny numeric not null default 0,
  rationale text not null default '',
  risk_notes text not null default '',
  source_round_id uuid references creative_proposal_rounds(id) on delete set null,
  source_job_id uuid references jobs(id) on delete set null,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create table if not exists delivery_checklists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  estimate_id uuid references workload_estimates(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'changed', 'archived')),
  version integer not null default 1,
  notes text not null default '',
  confirmed_by uuid references users(id),
  confirmed_at timestamptz,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create table if not exists delivery_checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  checklist_id uuid not null references delivery_checklists(id) on delete cascade,
  item_kind text not null,
  title text not null,
  description text not null default '',
  quantity integer not null default 1,
  status text not null default 'planned' check (status in ('planned', 'confirmed', 'changed', 'delivered', 'cancelled')),
  change_request_id uuid,
  sort_order integer not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists production_entities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  entity_type text not null check (entity_type in ('character', 'scene', 'prop')),
  name text not null,
  description text not null default '',
  importance text not null default 'normal' check (importance in ('normal', 'important', 'key')),
  reference_depth text not null default 'basic' check (reference_depth in ('basic', 'full')),
  source_shot_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'generating', 'internal_confirmed', 'client_reviewing', 'client_rejected', 'client_approved', 'locked')),
  version integer not null default 1,
  locked_at timestamptz,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists production_reference_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  entity_id uuid not null references production_entities(id) on delete cascade,
  depth text not null default 'basic' check (depth in ('basic', 'full')),
  status text not null default 'draft' check (status in ('draft', 'generating', 'internal_confirmed', 'client_reviewing', 'client_rejected', 'client_approved', 'locked')),
  prompt text not null default '',
  reference_image_ids jsonb not null default '[]'::jsonb,
  snapshot_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storyboard_image_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  batch_number integer not null check (batch_number in (1, 2, 3)),
  status text not null default 'draft' check (status in ('draft', 'internal_ready', 'client_reviewing', 'client_rejected', 'client_approved', 'locked')),
  version integer not null default 1,
  scene_ids jsonb not null default '[]'::jsonb,
  client_review_task_id uuid references client_review_tasks(id) on delete set null,
  snapshot_json jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, batch_number, version)
);

create table if not exists storyboard_image_batch_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  batch_id uuid not null references storyboard_image_batches(id) on delete cascade,
  scene_id uuid references storyboard_scenes(id) on delete set null,
  shot_id uuid references storyboard_shots(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_revision', 'locked')),
  selected_image_ids jsonb not null default '[]'::jsonb,
  feedback text not null default '',
  feedback_payload_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  sort_order integer not null default 0,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storyboard_image_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  scene_id uuid references storyboard_scenes(id) on delete set null,
  shot_id uuid not null references storyboard_shots(id) on delete cascade,
  storyboard_image_id uuid references storyboard_images(id) on delete set null,
  version integer not null default 1,
  selected_image_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'selected', 'client_reviewing', 'client_rejected', 'client_approved', 'locked')),
  snapshot_json jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shot_id, version)
);

create table if not exists storyboard_video_generation_inputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  storyboard_video_id uuid references storyboard_videos(id) on delete cascade,
  shot_id uuid references storyboard_shots(id) on delete cascade,
  mode text not null check (mode in ('single_image', 'start_end_frame', 'multi_reference')),
  input_image_ids jsonb not null default '[]'::jsonb,
  prompt text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_sop text not null,
  source_object_type text not null default '',
  source_object_id uuid,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'implemented', 'cancelled')),
  original_scope text not null default '',
  requested_scope text not null default '',
  impact_json jsonb not null default '{}'::jsonb,
  decision_reason text not null default '',
  decided_by uuid references users(id),
  decided_at timestamptz,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists archive_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'ready', 'completed', 'blocked', 'archived')),
  final_files_ready boolean not null default false,
  final_technical_check_passed boolean not null default false,
  tail_payment_confirmed boolean not null default false,
  client_received_confirmed boolean not null default false,
  rights_confirmed boolean not null default false,
  case_study_permission text not null default 'pending' check (case_study_permission in ('allowed', 'not_allowed', 'pending')),
  nas_archive_completed boolean not null default false,
  delivery_channel text not null default '',
  archive_location text not null default '',
  after_sales_note text not null default '',
  completed_by uuid references users(id),
  completed_at timestamptz,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create index if not exists risk_check_facts_card_idx on risk_check_facts (card_id, field_key);
create index if not exists risk_check_dimensions_card_idx on risk_check_dimensions (card_id, dimension_key);
create index if not exists creative_proposal_rounds_project_idx on creative_proposal_rounds (project_id, round_number, version desc);
create index if not exists creative_scene_concepts_round_idx on creative_scene_concepts (round_id, direction_id, scene_index);
create index if not exists creative_scene_images_concept_idx on creative_scene_images (scene_concept_id, sort_order, updated_at desc);
create index if not exists delivery_checklist_items_checklist_idx on delivery_checklist_items (checklist_id, sort_order, updated_at desc);
create index if not exists production_entities_project_idx on production_entities (project_id, entity_type, status, updated_at desc);
create index if not exists production_reference_sets_entity_idx on production_reference_sets (entity_id, depth, version desc);
create index if not exists storyboard_image_batches_project_idx on storyboard_image_batches (project_id, batch_number, version desc);
create index if not exists storyboard_image_batch_items_batch_idx on storyboard_image_batch_items (batch_id, sort_order, updated_at desc);
create index if not exists storyboard_image_versions_shot_idx on storyboard_image_versions (shot_id, version desc);
create index if not exists storyboard_video_generation_inputs_video_idx on storyboard_video_generation_inputs (storyboard_video_id, created_at desc);
create index if not exists change_requests_project_idx on change_requests (project_id, status, updated_at desc);
