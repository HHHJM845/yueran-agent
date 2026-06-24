import { query, withTransaction } from "@/lib/db";

export type ScoringRuleView = {
  id: string;
  tag: string;
  weight: number;
  description: string;
  positiveExamples: string[];
  negativeExamples: string[];
  isActive: boolean;
  version: number;
  updatedAt: string;
};

export type ScoringRuleVersionView = {
  id: string;
  ruleId: string;
  version: number;
  tag: string;
  weight: number;
  description: string;
  positiveExamples: string[];
  negativeExamples: string[];
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
};

type ScoringRuleRow = {
  id: string;
  tag: string;
  weight: string;
  description: string;
  positive_examples: unknown;
  negative_examples: unknown;
  is_active: boolean;
  version: number;
  updated_at: string;
};

type ScoringRuleVersionRow = {
  id: string;
  rule_id: string;
  version: number;
  tag: string;
  weight: string;
  description: string;
  positive_examples: unknown;
  negative_examples: unknown;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

type ScoringRuleWriteInput = {
  tag: string;
  weight: number;
  description: string;
  positiveExamples: string[];
  negativeExamples: string[];
  isActive: boolean;
  actorId: string;
};

export async function listScoringRules(input: { activeOnly?: boolean } = {}) {
  const result = await query<ScoringRuleRow>(
    `select id, tag, weight, description, positive_examples, negative_examples,
            is_active, version, updated_at
     from scoring_rules
     where ($1::boolean = false or is_active = true)
     order by tag asc`,
    [Boolean(input.activeOnly)]
  );

  return result.rows.map(mapRule);
}

export async function listScoringRuleVersions(ruleId: string) {
  const result = await query<ScoringRuleVersionRow>(
    `select id, rule_id, version, tag, weight, description, positive_examples,
            negative_examples, is_active, created_by, created_at
     from scoring_rule_versions
     where rule_id = $1
     order by version desc`,
    [ruleId]
  );

  return result.rows.map(mapRuleVersion);
}

export async function scoringRuleExists(ruleId: string) {
  const result = await query<{ exists: boolean }>(
    `select exists (
       select 1
       from scoring_rules
       where id = $1
     )`,
    [ruleId]
  );

  return Boolean(result.rows[0]?.exists);
}

export async function upsertScoringRule(input: ScoringRuleWriteInput) {
  return withTransaction(async (transactionQuery) => {
    await transactionQuery(`select pg_advisory_xact_lock(hashtext($1))`, [`scoring_rule:${input.tag}`]);

    const currentResult = await transactionQuery<ScoringRuleRow>(
      `select id, tag, weight, description, positive_examples, negative_examples,
              is_active, version, updated_at
       from scoring_rules
       where tag = $1
       for update`,
      [input.tag]
    );
    const current = currentResult.rows[0] ?? null;
    const nextVersion = getNextScoringRuleVersion(current?.version ?? null);

    const savedResult = current
      ? await transactionQuery<ScoringRuleRow>(
          `update scoring_rules
           set weight = $2,
               description = $3,
               positive_examples = $4::jsonb,
               negative_examples = $5::jsonb,
               is_active = $6,
               version = $7,
               updated_at = now()
           where id = $1
           returning id, tag, weight, description, positive_examples, negative_examples,
                     is_active, version, updated_at`,
          [
            current.id,
            input.weight,
            input.description,
            JSON.stringify(input.positiveExamples),
            JSON.stringify(input.negativeExamples),
            input.isActive,
            nextVersion,
          ]
        )
      : await transactionQuery<ScoringRuleRow>(
          `insert into scoring_rules (
             tag, weight, description, positive_examples, negative_examples,
             is_active, version, created_by
           )
           values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)
           returning id, tag, weight, description, positive_examples, negative_examples,
                     is_active, version, updated_at`,
          [
            input.tag,
            input.weight,
            input.description,
            JSON.stringify(input.positiveExamples),
            JSON.stringify(input.negativeExamples),
            input.isActive,
            nextVersion,
            input.actorId,
          ]
        );

    const saved = savedResult.rows[0];
    const snapshot = buildScoringRuleVersionSnapshot(saved);

    await transactionQuery(
      `insert into scoring_rule_versions (
         rule_id, version, tag, weight, description, positive_examples,
         negative_examples, is_active, created_by
       )
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
      [
        saved.id,
        snapshot.version,
        snapshot.tag,
        snapshot.weight,
        snapshot.description,
        JSON.stringify(snapshot.positiveExamples),
        JSON.stringify(snapshot.negativeExamples),
        snapshot.isActive,
        input.actorId,
      ]
    );

    await transactionQuery(
      `insert into audit_logs (actor_id, project_id, action, object_type, object_id, before_json, after_json)
       values ($1, null, $2, 'scoring_rule', $3, $4::jsonb, $5::jsonb)`,
      [
        input.actorId,
        current ? "scoring_rule.updated" : "scoring_rule.created",
        saved.id,
        current ? JSON.stringify(buildScoringRuleVersionSnapshot(current)) : null,
        JSON.stringify(snapshot),
      ]
    );

    return mapRule(saved);
  });
}

export function getNextScoringRuleVersion(currentVersion: number | null) {
  return currentVersion === null ? 1 : currentVersion + 1;
}

export function buildScoringRuleVersionSnapshot(row: ScoringRuleRow) {
  return {
    ruleId: row.id,
    version: row.version,
    tag: row.tag,
    weight: Number(row.weight),
    description: row.description,
    positiveExamples: toStringArray(row.positive_examples),
    negativeExamples: toStringArray(row.negative_examples),
    isActive: row.is_active,
  };
}

function mapRule(row: ScoringRuleRow): ScoringRuleView {
  return {
    id: row.id,
    tag: row.tag,
    weight: Number(row.weight),
    description: row.description,
    positiveExamples: toStringArray(row.positive_examples),
    negativeExamples: toStringArray(row.negative_examples),
    isActive: row.is_active,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

function mapRuleVersion(row: ScoringRuleVersionRow): ScoringRuleVersionView {
  return {
    id: row.id,
    ruleId: row.rule_id,
    version: row.version,
    tag: row.tag,
    weight: Number(row.weight),
    description: row.description,
    positiveExamples: toStringArray(row.positive_examples),
    negativeExamples: toStringArray(row.negative_examples),
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}
