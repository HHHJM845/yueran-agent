import { query, withTransaction, type TransactionQuery } from "@/lib/db";
import type { RiskCheckDecision, RiskCheckDraft } from "@/server/use-cases/risk-check-card";

export type RiskCheckCardView = {
  id: string;
  projectId: string;
  status: "draft" | "in_review" | "needs_revision" | "approved" | "archived";
  overallAlert: "low" | "medium" | "high" | "redline";
  humanDecision: RiskCheckDecision | null;
  decisionReason: string;
  decidedBy: string | null;
  decidedAt: string | null;
  sourceArtifactId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RiskCheckFactView = {
  id: string;
  projectId: string;
  cardId: string;
  fieldKey: string;
  fieldLabel: string;
  value: unknown;
  evidence: string;
  confidence: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RiskCheckDimensionView = {
  id: string;
  projectId: string;
  cardId: string;
  dimensionKey: string;
  level: "low" | "medium" | "high";
  evidence: string;
  anchorText: string;
  confidence: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RiskCheckBundleView = {
  card: RiskCheckCardView;
  facts: RiskCheckFactView[];
  dimensions: RiskCheckDimensionView[];
  redlineAlerts: string[];
};

type RiskCheckCardRow = {
  id: string;
  project_id: string;
  status: RiskCheckCardView["status"];
  overall_alert: RiskCheckCardView["overallAlert"];
  human_decision: RiskCheckDecision | null;
  decision_reason: string;
  decided_by: string | null;
  decided_at: string | null;
  source_artifact_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type RiskCheckFactRow = {
  id: string;
  project_id: string;
  card_id: string;
  field_key: string;
  field_label: string;
  value_json: unknown;
  evidence: string;
  confidence: string | number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type RiskCheckDimensionRow = {
  id: string;
  project_id: string;
  card_id: string;
  dimension_key: string;
  level: RiskCheckDimensionView["level"];
  evidence: string;
  anchor_text: string;
  confidence: string | number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function getProjectRiskCheck(projectId: string): Promise<RiskCheckBundleView | null> {
  const cardResult = await query<RiskCheckCardRow>(
    `select id, project_id, status, overall_alert, human_decision, decision_reason,
            decided_by, decided_at, source_artifact_id, created_by, created_at, updated_at
     from risk_check_cards
     where project_id = $1
     limit 1`,
    [projectId]
  );

  const cardRow = cardResult.rows[0];
  if (!cardRow) return null;

  const [factsResult, dimensionsResult] = await Promise.all([
    query<RiskCheckFactRow>(
      `select id, project_id, card_id, field_key, field_label, value_json, evidence, confidence,
              created_by, created_at, updated_at
       from risk_check_facts
       where project_id = $1 and card_id = $2
       order by created_at asc, field_key asc`,
      [projectId, cardRow.id]
    ),
    query<RiskCheckDimensionRow>(
      `select id, project_id, card_id, dimension_key, level, evidence, anchor_text, confidence,
              created_by, created_at, updated_at
       from risk_check_dimensions
       where project_id = $1 and card_id = $2
       order by created_at asc, dimension_key asc`,
      [projectId, cardRow.id]
    ),
  ]);

  const dimensions = dimensionsResult.rows.map(mapDimension);
  return {
    card: mapCard(cardRow),
    facts: factsResult.rows.map(mapFact),
    dimensions,
    redlineAlerts: deriveRedlineAlerts(mapCard(cardRow).overallAlert, dimensions),
  };
}

export async function upsertRiskCheckDraft(input: {
  projectId: string;
  actorId: string;
  draft: RiskCheckDraft;
  sourceArtifactId?: string | null;
}): Promise<RiskCheckBundleView> {
  return withTransaction(async (tx) => {
    const cardResult = await tx<RiskCheckCardRow>(
      `insert into risk_check_cards (
         project_id, status, overall_alert, human_decision, decision_reason, decided_by, decided_at, source_artifact_id, created_by
       )
       values (
         $1, $2, $3, null, '', null, null, $4,
         case when exists (select 1 from users where id = $5::uuid) then $5::uuid else null end
       )
       on conflict (project_id)
       do update set
         status = excluded.status,
         overall_alert = excluded.overall_alert,
         source_artifact_id = excluded.source_artifact_id,
         updated_at = now()
       returning id, project_id, status, overall_alert, human_decision, decision_reason,
                 decided_by, decided_at, source_artifact_id, created_by, created_at, updated_at`,
      [input.projectId, input.draft.status, input.draft.overallAlert, input.sourceArtifactId ?? null, input.actorId]
    );

    const cardRow = cardResult.rows[0];

    await tx(`delete from risk_check_facts where project_id = $1 and card_id = $2`, [input.projectId, cardRow.id]);
    await tx(`delete from risk_check_dimensions where project_id = $1 and card_id = $2`, [input.projectId, cardRow.id]);

    for (const fact of input.draft.facts) {
      await insertFact(tx, {
        projectId: input.projectId,
        cardId: cardRow.id,
        actorId: input.actorId,
        fieldKey: fact.fieldKey,
        fieldLabel: fact.fieldLabel,
        value: fact.value,
        evidence: fact.evidence,
        confidence: fact.confidence,
      });
    }

    for (const dimension of input.draft.dimensions) {
      await insertDimension(tx, {
        projectId: input.projectId,
        cardId: cardRow.id,
        actorId: input.actorId,
        dimensionKey: dimension.dimensionKey,
        level: dimension.level,
        evidence: dimension.evidence,
        anchorText: dimension.anchorText,
        confidence: dimension.confidence,
      });
    }

    const [factsResult, dimensionsResult] = await Promise.all([
      tx<RiskCheckFactRow>(
        `select id, project_id, card_id, field_key, field_label, value_json, evidence, confidence,
                created_by, created_at, updated_at
         from risk_check_facts
         where project_id = $1 and card_id = $2
         order by created_at asc, field_key asc`,
        [input.projectId, cardRow.id]
      ),
      tx<RiskCheckDimensionRow>(
        `select id, project_id, card_id, dimension_key, level, evidence, anchor_text, confidence,
                created_by, created_at, updated_at
         from risk_check_dimensions
         where project_id = $1 and card_id = $2
         order by created_at asc, dimension_key asc`,
        [input.projectId, cardRow.id]
      ),
    ]);

    const card = mapCard(cardRow);
    const dimensions = dimensionsResult.rows.map(mapDimension);

    return {
      card,
      facts: factsResult.rows.map(mapFact),
      dimensions,
      redlineAlerts: deriveRedlineAlerts(card.overallAlert, dimensions),
    };
  });
}

export async function updateRiskCheckDecision(input: {
  projectId: string;
  cardId: string;
  decision: RiskCheckDecision;
  reason: string;
  actorId: string;
}): Promise<RiskCheckCardView | null> {
  const result = await query<RiskCheckCardRow>(
    `update risk_check_cards
     set human_decision = $3,
         decision_reason = $4,
         decided_by = case when exists (select 1 from users where id = $5::uuid) then $5::uuid else null end,
         decided_at = now(),
         status = case when $3 = 'reject' then 'needs_revision' else 'approved' end,
         updated_at = now()
     where project_id = $1 and id = $2
     returning id, project_id, status, overall_alert, human_decision, decision_reason,
               decided_by, decided_at, source_artifact_id, created_by, created_at, updated_at`,
    [input.projectId, input.cardId, input.decision, input.reason.trim(), input.actorId]
  );

  return result.rows[0] ? mapCard(result.rows[0]) : null;
}

async function insertFact(
  tx: TransactionQuery,
  input: {
    projectId: string;
    cardId: string;
    actorId: string;
    fieldKey: string;
    fieldLabel: string;
    value: unknown;
    evidence: string;
    confidence: number;
  }
) {
  await tx(
    `insert into risk_check_facts (
       project_id, card_id, field_key, field_label, value_json, evidence, confidence, created_by
     )
     values (
       $1, $2, $3, $4, $5::jsonb, $6, $7,
       case when exists (select 1 from users where id = $8::uuid) then $8::uuid else null end
     )`,
    [
      input.projectId,
      input.cardId,
      input.fieldKey,
      input.fieldLabel,
      JSON.stringify(input.value),
      input.evidence,
      input.confidence,
      input.actorId,
    ]
  );
}

async function insertDimension(
  tx: TransactionQuery,
  input: {
    projectId: string;
    cardId: string;
    actorId: string;
    dimensionKey: string;
    level: RiskCheckDimensionView["level"];
    evidence: string;
    anchorText: string;
    confidence: number;
  }
) {
  await tx(
    `insert into risk_check_dimensions (
       project_id, card_id, dimension_key, level, evidence, anchor_text, confidence, created_by
     )
     values (
       $1, $2, $3, $4, $5, $6, $7,
       case when exists (select 1 from users where id = $8::uuid) then $8::uuid else null end
     )`,
    [input.projectId, input.cardId, input.dimensionKey, input.level, input.evidence, input.anchorText, input.confidence, input.actorId]
  );
}

function mapCard(row: RiskCheckCardRow): RiskCheckCardView {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    overallAlert: row.overall_alert,
    humanDecision: row.human_decision,
    decisionReason: row.decision_reason,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    sourceArtifactId: row.source_artifact_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFact(row: RiskCheckFactRow): RiskCheckFactView {
  return {
    id: row.id,
    projectId: row.project_id,
    cardId: row.card_id,
    fieldKey: row.field_key,
    fieldLabel: row.field_label,
    value: row.value_json,
    evidence: row.evidence,
    confidence: Number(row.confidence),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDimension(row: RiskCheckDimensionRow): RiskCheckDimensionView {
  return {
    id: row.id,
    projectId: row.project_id,
    cardId: row.card_id,
    dimensionKey: row.dimension_key,
    level: row.level,
    evidence: row.evidence,
    anchorText: row.anchor_text,
    confidence: Number(row.confidence),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function deriveRedlineAlerts(
  overallAlert: RiskCheckCardView["overallAlert"],
  dimensions: RiskCheckDimensionView[]
) {
  if (overallAlert !== "redline") return [];
  const compliance = dimensions.find((item) => item.dimensionKey === "compliance");
  if (compliance?.evidence) {
    return [`红线风险：${compliance.evidence}`];
  }
  return ["红线风险：当前 Brief 命中了需要老板决策的高风险组合。"];
}
