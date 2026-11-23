import crypto from 'crypto';
import { getGcpAccessToken, getRuntimeStorageConfig } from './gcs-adapter';
import {
  ApiConfig,
  CatalogItem,
  CurriculumPlan,
  LearningActivity,
  Member,
  OrganizationOfficialStats,
  SyncStatus,
  Team,
  TeamGoalConfig,
} from '../types';

export interface BigQueryFieldSchema {
  name: string;
  type: 'STRING' | 'INT64' | 'FLOAT64' | 'BOOL' | 'TIMESTAMP' | 'DATE';
  mode?: 'NULLABLE' | 'REQUIRED' | 'REPEATED';
  description?: string;
}

export interface BigQueryTableDefinition {
  tableId: string;
  description: string;
  fields: BigQueryFieldSchema[];
  timePartitioning?: {
    type: 'DAY' | 'MONTH' | 'YEAR';
    field: string;
  };
  clustering?: string[];
}

export interface BigQuerySnapshotPayload {
  apiConfig: ApiConfig;
  orgStats?: OrganizationOfficialStats;
  catalog: CatalogItem[];
  teams: Team[];
  members: Member[];
  activities: LearningActivity[];
  goals?: TeamGoalConfig[];
  curricula?: CurriculumPlan[];
  syncStatus: SyncStatus;
}

// ============================================================================
// BigQuery Enterprise Dimensional & Operational Table Definitions
// ============================================================================
export const BQ_TABLE_DEFINITIONS: Record<string, BigQueryTableDefinition> = {
  fact_learning_activities: {
    tableId: 'fact_learning_activities',
    description:
      'Tabla de hechos histórica de actividades de capacitación sincronizadas desde Google Skills API v2.',
    timePartitioning: {
      type: 'MONTH',
      field: 'activity_date',
    },
    clustering: ['team_slug', 'category', 'activity_type', 'member_email'],
    fields: [
      {
        name: 'activity_key',
        type: 'STRING',
        mode: 'REQUIRED',
        description: 'Llave determinística SHA-256 para deduplicación incremental (MERGE).',
      },
      { name: 'activity_id', type: 'STRING', mode: 'NULLABLE' },
      { name: 'member_email', type: 'STRING', mode: 'REQUIRED' },
      { name: 'member_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'team_slug', type: 'STRING', mode: 'NULLABLE' },
      { name: 'team_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'content_id', type: 'STRING', mode: 'NULLABLE' },
      { name: 'activity_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'activity_type', type: 'STRING', mode: 'NULLABLE' },
      { name: 'category', type: 'STRING', mode: 'NULLABLE' },
      { name: 'passed', type: 'BOOL', mode: 'NULLABLE' },
      { name: 'given_score', type: 'FLOAT64', mode: 'NULLABLE' },
      { name: 'maximum_score', type: 'FLOAT64', mode: 'NULLABLE' },
      { name: 'given_score_raw', type: 'STRING', mode: 'NULLABLE' },
      { name: 'maximum_score_raw', type: 'STRING', mode: 'NULLABLE' },
      { name: 'learning_time_minutes', type: 'FLOAT64', mode: 'NULLABLE' },
      { name: 'started_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
      { name: 'completed_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
      {
        name: 'activity_date',
        type: 'DATE',
        mode: 'NULLABLE',
        description: 'Fecha base de particionamiento mensual (COALESCE de finalización o inicio).',
      },
      { name: 'content_url', type: 'STRING', mode: 'NULLABLE' },
      { name: 'parent_type', type: 'STRING', mode: 'NULLABLE' },
      { name: 'parent_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'synced_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    ],
  },

  dim_catalog: {
    tableId: 'dim_catalog',
    description: 'Dimensión del catálogo oficial de cursos, rutas, laboratorios y certificaciones.',
    clustering: ['category', 'content_type', 'level'],
    fields: [
      { name: 'content_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'content_type', type: 'STRING', mode: 'NULLABLE' },
      { name: 'name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'description', type: 'STRING', mode: 'NULLABLE' },
      { name: 'duration_minutes', type: 'INT64', mode: 'NULLABLE' },
      { name: 'level', type: 'STRING', mode: 'NULLABLE' },
      { name: 'available_locales', type: 'STRING', mode: 'REPEATED' },
      { name: 'url', type: 'STRING', mode: 'NULLABLE' },
      { name: 'category', type: 'STRING', mode: 'NULLABLE' },
      { name: 'synced_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    ],
  },

  dim_teams: {
    tableId: 'dim_teams',
    description: 'Dimensión de equipos configurados en Google Skills for Organizations.',
    fields: [
      { name: 'slug', type: 'STRING', mode: 'REQUIRED' },
      { name: 'name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'description', type: 'STRING', mode: 'NULLABLE' },
      { name: 'active', type: 'BOOL', mode: 'NULLABLE' },
      { name: 'member_count', type: 'INT64', mode: 'NULLABLE' },
      { name: 'synced_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    ],
  },

  dim_members: {
    tableId: 'dim_members',
    description: 'Dimensión de colaboradores asignados a equipos y estado de invitación.',
    clustering: ['team_slug', 'status'],
    fields: [
      { name: 'email', type: 'STRING', mode: 'REQUIRED' },
      { name: 'first_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'last_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'status', type: 'STRING', mode: 'NULLABLE' },
      { name: 'team_slug', type: 'STRING', mode: 'NULLABLE' },
      { name: 'team_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'synced_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    ],
  },

  fact_org_stats_snapshots: {
    tableId: 'fact_org_stats_snapshots',
    description:
      'Serie histórica de instantáneas oficiales (/organizations/{slug}/stats) para seguimiento de licencias y badges.',
    timePartitioning: {
      type: 'MONTH',
      field: 'snapshot_date',
    },
    fields: [
      { name: 'snapshot_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'snapshot_date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'fetched_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'organization_slug', type: 'STRING', mode: 'NULLABLE' },
      { name: 'contracted_licenses', type: 'INT64', mode: 'NULLABLE' },
      { name: 'accepted_invitations', type: 'INT64', mode: 'NULLABLE' },
      { name: 'pending_invitations', type: 'INT64', mode: 'NULLABLE' },
      { name: 'cumulative_learners', type: 'INT64', mode: 'NULLABLE' },
      { name: 'labs_started', type: 'INT64', mode: 'NULLABLE' },
      { name: 'courses_enrolled', type: 'INT64', mode: 'NULLABLE' },
      { name: 'labs_passed', type: 'INT64', mode: 'NULLABLE' },
      { name: 'courses_completed', type: 'INT64', mode: 'NULLABLE' },
      { name: 'skills_badges_earned', type: 'INT64', mode: 'NULLABLE' },
      { name: 'window_start', type: 'STRING', mode: 'NULLABLE' },
      { name: 'window_end', type: 'STRING', mode: 'NULLABLE' },
    ],
  },

  app_goals_okrs: {
    tableId: 'app_goals_okrs',
    description: 'Metas trimestrales y OKRs configurados en el tablero ejecutivo.',
    fields: [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'team_slug', type: 'STRING', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING', mode: 'REQUIRED' },
      { name: 'target_hours_per_member', type: 'FLOAT64', mode: 'REQUIRED' },
      { name: 'target_adoption_rate', type: 'FLOAT64', mode: 'REQUIRED' },
      { name: 'target_category', type: 'STRING', mode: 'NULLABLE' },
      { name: 'target_category_completions', type: 'INT64', mode: 'NULLABLE' },
      { name: 'quarter_label', type: 'STRING', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    ],
  },

  app_ai_curricula: {
    tableId: 'app_ai_curricula',
    description: 'Planes curriculares generados con Gemini IA para equipos de la organización.',
    fields: [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'target_role', type: 'STRING', mode: 'REQUIRED' },
      { name: 'team_slug', type: 'STRING', mode: 'REQUIRED' },
      { name: 'team_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'weeks_count', type: 'INT64', mode: 'NULLABLE' },
      { name: 'hours_per_week', type: 'FLOAT64', mode: 'NULLABLE' },
      { name: 'generated_by_model', type: 'STRING', mode: 'NULLABLE' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'payload_json', type: 'STRING', mode: 'REQUIRED' },
    ],
  },

  sync_audit_log: {
    tableId: 'sync_audit_log',
    description: 'Bitácora de sincronizaciones y metadatos de control de caché multi-instancia.',
    timePartitioning: {
      type: 'MONTH',
      field: 'sync_date',
    },
    fields: [
      { name: 'sync_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'sync_date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'synced_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'mode', type: 'STRING', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'message', type: 'STRING', mode: 'NULLABLE' },
      { name: 'organization_slug', type: 'STRING', mode: 'NULLABLE' },
      { name: 'contracted_licenses', type: 'INT64', mode: 'NULLABLE' },
      { name: 'catalog_count', type: 'INT64', mode: 'NULLABLE' },
      { name: 'teams_count', type: 'INT64', mode: 'NULLABLE' },
      { name: 'members_count', type: 'INT64', mode: 'NULLABLE' },
      { name: 'activities_count', type: 'INT64', mode: 'NULLABLE' },
    ],
  },
};

export function buildAnalyticalViewsSql(projectId: string, datasetId: string): Record<string, string> {
  const fq = (table: string) => `\`${projectId}.${datasetId}.${table}\``;

  return {
    vw_executive_kpis: `
WITH monthly_base AS (
  SELECT
    DATE_TRUNC(COALESCE( DATE(completed_at), DATE(started_at), activity_date ), MONTH) AS activity_month,
    member_email,
    activity_type,
    passed,
    COALESCE(learning_time_minutes, 0) / 60.0 AS hours_spent
  FROM ${fq('fact_learning_activities')}
  WHERE activity_date IS NOT NULL OR started_at IS NOT NULL OR completed_at IS NOT NULL
)
SELECT
  activity_month,
  COUNT(*) AS total_activities_started,
  COUNTIF(passed IS TRUE) AS total_completions_passed,
  COUNTIF(activity_type = 'Lab' AND passed IS TRUE) AS passed_labs,
  COUNTIF(activity_type = 'Course' AND passed IS TRUE) AS completed_courses,
  COUNT(DISTINCT member_email) AS active_learners,
  ROUND(SUM(hours_spent), 2) AS total_hours_spent,
  ROUND(SAFE_DIVIDE(COUNTIF(passed IS TRUE) * 100.0, COUNT(*)), 2) AS pass_rate_pct
FROM monthly_base
GROUP BY activity_month`,

    vw_license_adoption_roi: `
WITH learner_agg AS (
  SELECT
    LOWER(member_email) AS email,
    ANY_VALUE(member_name) AS fallback_name,
    ANY_VALUE(team_name) AS fallback_team_name,
    COUNT(*) AS activities_started,
    COUNTIF(passed IS TRUE) AS activities_completed,
    ROUND(SUM(COALESCE(learning_time_minutes, 0)) / 60.0, 2) AS hours_spent,
    MAX(COALESCE(completed_at, started_at)) AS last_activity_at,
    COUNTIF(EXTRACT(YEAR FROM COALESCE(completed_at, started_at)) = EXTRACT(YEAR FROM CURRENT_TIMESTAMP())) AS current_year_activities
  FROM ${fq('fact_learning_activities')}
  GROUP BY LOWER(member_email)
),
roster_dedup AS (
  SELECT
    LOWER(email) AS email,
    ANY_VALUE(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS full_name,
    ANY_VALUE(status) AS invite_status,
    ANY_VALUE(team_slug) AS team_slug,
    ANY_VALUE(team_name) AS team_name
  FROM ${fq('dim_members')}
  GROUP BY LOWER(email)
)
SELECT
  COALESCE(r.email, a.email) AS email,
  COALESCE(NULLIF(TRIM(r.full_name), ''), a.fallback_name, COALESCE(r.email, a.email)) AS learner_name,
  COALESCE(r.team_name, a.fallback_team_name, 'Organización General (Sin Equipo)') AS team_name,
  COALESCE(r.invite_status, 'active') AS invite_status,
  COALESCE(a.activities_started, 0) AS activities_started,
  COALESCE(a.activities_completed, 0) AS activities_completed,
  COALESCE(a.hours_spent, 0.0) AS hours_spent,
  a.last_activity_at,
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), a.last_activity_at, DAY) AS days_since_last_activity,
  CASE
    WHEN COALESCE(a.activities_started, 0) = 0 THEN 'Sin Uso'
    WHEN COALESCE(a.current_year_activities, 0) = 0 THEN 'Cohorte Previa'
    WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), a.last_activity_at, DAY) > 30 THEN 'En Riesgo'
    ELSE 'Activo'
  END AS risk_status
FROM roster_dedup r
FULL OUTER JOIN learner_agg a
  ON r.email = a.email`,

    vw_team_skill_matrix: `
SELECT
  COALESCE(team_slug, 'organizacion-general') AS team_slug,
  COALESCE(team_name, 'Organización General (Sin Equipo)') AS team_name,
  COALESCE(category, 'Cloud Infrastructure') AS skill_category,
  COUNT(DISTINCT LOWER(member_email)) AS active_learners,
  COUNT(*) AS activities_started,
  COUNTIF(passed IS TRUE) AS activities_passed,
  ROUND(SUM(COALESCE(learning_time_minutes, 0)) / 60.0, 2) AS hours_trained
FROM ${fq('fact_learning_activities')}
GROUP BY 1, 2, 3`,

    vw_certification_candidates: `
WITH path_progress AS (
  SELECT
    LOWER(member_email) AS email,
    ANY_VALUE(member_name) AS learner_name,
    ANY_VALUE(team_name) AS team_name,
    parent_name AS target_track,
    ANY_VALUE(category) AS category,
    COUNT(*) AS started_modules,
    COUNTIF(passed IS TRUE) AS passed_modules,
    ROUND(AVG(SAFE_DIVIDE(given_score, NULLIF(maximum_score, 0)) * 100.0), 1) AS avg_score_pct,
    ROUND(SUM(COALESCE(learning_time_minutes, 0)) / 60.0, 2) AS hours_spent
  FROM ${fq('fact_learning_activities')}
  WHERE parent_name IS NOT NULL AND TRIM(parent_name) != ''
  GROUP BY LOWER(member_email), parent_name
)
SELECT
  email,
  learner_name,
  COALESCE(team_name, 'Organización General (Sin Equipo)') AS team_name,
  target_track,
  category,
  started_modules,
  passed_modules,
  COALESCE(avg_score_pct, 100.0) AS avg_score_pct,
  hours_spent,
  LEAST(100, CAST(ROUND(passed_modules * 15 + hours_spent * 3.5) AS INT64)) AS readiness_score,
  CASE
    WHEN passed_modules >= 5 AND hours_spent >= 8 THEN 'Listo para Voucher'
    WHEN passed_modules >= 3 OR hours_spent >= 4 THEN 'En Progreso Avanzado'
    ELSE 'Inicial'
  END AS readiness_status
FROM path_progress
WHERE passed_modules >= 1`,
  };
}

// ============================================================================
// Low-level BigQuery REST API v2 Helpers (Zero external SDK bloat)
// ============================================================================
const BQ_BASE_URL = 'https://bigquery.googleapis.com/bigquery/v2';
const BQ_UPLOAD_URL = 'https://bigquery.googleapis.com/upload/bigquery/v2';

async function bqFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 45000
): Promise<{ status: number; ok: boolean; data: T | null; rawText?: string }> {
  const token = await getGcpAccessToken();
  const url = endpoint.startsWith('http') ? endpoint : `${BQ_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(options.body && !(options.headers as Record<string, string>)?.['Content-Type']
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 404) {
    return { status: 404, ok: false, data: null };
  }

  const text = await res.text();
  if (!res.ok) {
    return { status: res.status, ok: false, data: null, rawText: text };
  }

  return {
    status: res.status,
    ok: true,
    data: text ? (JSON.parse(text) as T) : null,
  };
}

function parseIsoTimestamp(val?: string | null): string | null {
  if (!val || !val.trim()) return null;
  const parsed = Date.parse(val);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function parseIsoDateOnly(val?: string | null): string | null {
  const ts = parseIsoTimestamp(val);
  return ts ? ts.slice(0, 10) : null;
}

function parseOptionalNumber(val?: string | number | null): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function computeActivityKey(a: LearningActivity): string {
  const raw = [
    (a.Member || '').trim().toLowerCase(),
    (a['Content ID'] || a.Activity || '').trim(),
    (a['Date started'] || a['Date completed'] || '').trim(),
    (a['Activity Type'] || '').trim(),
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

interface BqQueryParameter {
  name: string;
  parameterType: { type: string };
  parameterValue: { value: string | null };
}

export async function runBigQuerySql<T = Record<string, any>>(
  sql: string,
  params?: Record<string, { type: string; value: string | number | boolean | null }>,
  overrideCfg?: { projectId?: string; location?: string }
): Promise<T[]> {
  const rt = getRuntimeStorageConfig();
  const projectId = overrideCfg?.projectId || rt.bqProjectId;
  const location = overrideCfg?.location || rt.bqLocation || 'us-central1';

  if (!projectId) {
    throw new Error(
      'Falta definir BQ_PROJECT_ID o GCP_PROJECT_ID para ejecutar consultas en BigQuery.'
    );
  }

  const queryParameters: BqQueryParameter[] | undefined = params
    ? Object.entries(params).map(([name, p]) => ({
        name,
        parameterType: { type: p.type },
        parameterValue: {
          value: p.value === null || p.value === undefined ? null : String(p.value),
        },
      }))
    : undefined;

  const startRes = await bqFetch<any>(
    `/projects/${encodeURIComponent(projectId)}/queries`,
    {
      method: 'POST',
      body: JSON.stringify({
        query: sql,
        useLegacySql: false,
        location,
        maxResults: 10000,
        timeoutMs: 25000,
        ...(queryParameters ? { parameterMode: 'NAMED', queryParameters } : {}),
      }),
    },
    60000
  );

  if (!startRes.ok || !startRes.data) {
    throw new Error(
      `Error en consulta BigQuery (HTTP ${startRes.status}): ${(startRes.rawText || '').slice(0, 300)}`
    );
  }

  let queryData = startRes.data;
  const jobId = queryData.jobReference?.jobId;
  const jobLocation = queryData.jobReference?.location || location;

  // Poll if query took longer than initial synchronous wait
  let pollAttempt = 0;
  while (!queryData.jobComplete && jobId && pollAttempt < 60) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await bqFetch<any>(
      `/projects/${encodeURIComponent(projectId)}/queries/${encodeURIComponent(
        jobId
      )}?location=${encodeURIComponent(jobLocation)}&maxResults=10000`
    );
    if (!pollRes.ok || !pollRes.data) {
      throw new Error(
        `Error sondeando Job SQL ${jobId} en BigQuery: ${(pollRes.rawText || '').slice(0, 250)}`
      );
    }
    queryData = pollRes.data;
    pollAttempt++;
  }

  const fields: BigQueryFieldSchema[] = queryData.schema?.fields || [];
  const allRawRows: any[] = [...(queryData.rows || [])];
  let pageToken: string | undefined = queryData.pageToken;

  while (pageToken && jobId) {
    const pageRes = await bqFetch<any>(
      `/projects/${encodeURIComponent(projectId)}/queries/${encodeURIComponent(
        jobId
      )}?location=${encodeURIComponent(jobLocation)}&maxResults=10000&pageToken=${encodeURIComponent(
        pageToken
      )}`
    );
    if (!pageRes.ok || !pageRes.data) break;
    if (pageRes.data.rows) {
      allRawRows.push(...pageRes.data.rows);
    }
    pageToken = pageRes.data.pageToken;
  }

  return allRawRows.map((row) => decodeBqRow(row, fields) as T);
}

function decodeBqValue(val: any, field: BigQueryFieldSchema): any {
  if (val === null || val === undefined) {
    return field.mode === 'REPEATED' ? [] : null;
  }
  if (field.mode === 'REPEATED' && Array.isArray(val)) {
    return val.map((item) => decodeBqValue(item.v, { ...field, mode: 'NULLABLE' }));
  }
  switch (field.type) {
    case 'INT64':
    case 'FLOAT64':
      return Number(val);
    case 'BOOL':
      return val === true || val === 'true';
    case 'TIMESTAMP': {
      // BigQuery REST API returns epoch seconds as float string e.g. "1732300000.123"
      const num = Number(val);
      if (Number.isFinite(num)) {
        return new Date(num * 1000).toISOString();
      }
      return String(val);
    }
    default:
      return String(val);
  }
}

function decodeBqRow(row: { f?: { v: any }[] }, fields: BigQueryFieldSchema[]): Record<string, any> {
  const out: Record<string, any> = {};
  const cells = row.f || [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    out[field.name] = decodeBqValue(cells[i]?.v, field);
  }
  return out;
}

async function runBqLoadJob(
  projectId: string,
  datasetId: string,
  location: string,
  tableDef: BigQueryTableDefinition,
  rows: Record<string, any>[],
  writeDisposition: 'WRITE_TRUNCATE' | 'WRITE_APPEND'
): Promise<void> {
  if (rows.length === 0) {
    if (writeDisposition === 'WRITE_TRUNCATE') {
      await runBigQuerySql(
        `TRUNCATE TABLE \`${projectId}.${datasetId}.${tableDef.tableId}\``,
        undefined,
        { projectId, location }
      );
    }
    return;
  }

  const ndjson = rows.map((r) => JSON.stringify(r)).join('\n');
  const metadata = {
    configuration: {
      load: {
        destinationTable: {
          projectId,
          datasetId,
          tableId: tableDef.tableId,
        },
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition,
        ignoreUnknownValues: true,
        schema: {
          fields: tableDef.fields,
        },
        ...(tableDef.timePartitioning ? { timePartitioning: tableDef.timePartitioning } : {}),
        ...(tableDef.clustering ? { clustering: { fields: tableDef.clustering } } : {}),
      },
      labels: {
        app: 'skillsboost_dashboard',
      },
    },
    jobReference: {
      projectId,
      location,
    },
  };

  const boundary = `skillsboost_bq_boundary_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n` +
    `${ndjson}\r\n` +
    `--${boundary}--`;

  const uploadRes = await bqFetch<any>(
    `${BQ_UPLOAD_URL}/projects/${encodeURIComponent(projectId)}/jobs?uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
    120000
  );

  if (!uploadRes.ok || !uploadRes.data) {
    throw new Error(
      `Error iniciando Load Job hacia ${tableDef.tableId} (HTTP ${uploadRes.status}): ${(
        uploadRes.rawText || ''
      ).slice(0, 300)}`
    );
  }

  const jobId = uploadRes.data.jobReference?.jobId;
  const jobLoc = uploadRes.data.jobReference?.location || location;

  for (let attempt = 0; attempt < 90; attempt++) {
    const jobRes = await bqFetch<any>(
      `/projects/${encodeURIComponent(projectId)}/jobs/${encodeURIComponent(
        jobId
      )}?location=${encodeURIComponent(jobLoc)}`
    );
    if (!jobRes.ok || !jobRes.data) {
      throw new Error(
        `Error verificando Load Job ${jobId} en BigQuery: ${(jobRes.rawText || '').slice(0, 250)}`
      );
    }
    if (jobRes.data.status?.state === 'DONE') {
      if (jobRes.data.status?.errorResult) {
        throw new Error(
          `Load Job BigQuery falló en ${tableDef.tableId}: ${JSON.stringify(
            jobRes.data.status.errorResult
          )}`
        );
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  throw new Error(`Load Job BigQuery ${jobId} (${tableDef.tableId}) excedió el tiempo de espera.`);
}

// ============================================================================
// Schema Provisioning (Dataset + Partitioned/Clustered Tables + BI Views)
// ============================================================================
let schemaVerifiedOnce = false;

export async function ensureBigQuerySchema(options?: {
  force?: boolean;
  includeViews?: boolean;
}): Promise<{ projectId: string; datasetId: string; location: string }> {
  const rt = getRuntimeStorageConfig();
  const projectId = rt.bqProjectId;
  const datasetId = rt.bqDatasetId;
  const location = rt.bqLocation;

  if (!projectId) {
    throw new Error(
      'Falta configurar GCP_PROJECT_ID (o BQ_PROJECT_ID) para inicializar el almacén en BigQuery.'
    );
  }

  if (schemaVerifiedOnce && !options?.force) {
    return { projectId, datasetId, location };
  }

  // 1. Check / create Dataset
  const dsCheck = await bqFetch(
    `/projects/${encodeURIComponent(projectId)}/datasets/${encodeURIComponent(datasetId)}`
  );
  if (dsCheck.status === 404) {
    console.log(
      `📊 [BigQuery] Creando dataset ${projectId}:${datasetId} en ubicación ${location}...`
    );
    const createDs = await bqFetch(
      `/projects/${encodeURIComponent(projectId)}/datasets`,
      {
        method: 'POST',
        body: JSON.stringify({
          datasetReference: { projectId, datasetId },
          location,
          description:
            'Data Warehouse Analítico y Operativo — Google Skills for Organizations Dashboard',
          labels: {
            app: 'skillsboost_dashboard',
            managed_by: 'skillsboost',
          },
        }),
      }
    );
    if (!createDs.ok && createDs.status !== 409) {
      throw new Error(
        `No se pudo crear el dataset ${datasetId} en BigQuery (HTTP ${createDs.status}): ${(
          createDs.rawText || ''
        ).slice(0, 250)}`
      );
    }
  } else if (!dsCheck.ok) {
    throw new Error(
      `Error accediendo al dataset ${projectId}:${datasetId} (HTTP ${dsCheck.status}): ${(
        dsCheck.rawText || ''
      ).slice(0, 250)}`
    );
  }

  // 2. Check / create all 8 core tables
  const tableDefs = Object.values(BQ_TABLE_DEFINITIONS);
  await Promise.all(
    tableDefs.map(async (def) => {
      const tblCheck = await bqFetch(
        `/projects/${encodeURIComponent(projectId)}/datasets/${encodeURIComponent(
          datasetId
        )}/tables/${encodeURIComponent(def.tableId)}`
      );
      if (tblCheck.status === 404) {
        const createTbl = await bqFetch(
          `/projects/${encodeURIComponent(projectId)}/datasets/${encodeURIComponent(
            datasetId
          )}/tables`,
          {
            method: 'POST',
            body: JSON.stringify({
              tableReference: {
                projectId,
                datasetId,
                tableId: def.tableId,
              },
              description: def.description,
              schema: { fields: def.fields },
              ...(def.timePartitioning ? { timePartitioning: def.timePartitioning } : {}),
              ...(def.clustering ? { clustering: { fields: def.clustering } } : {}),
              labels: {
                app: 'skillsboost_dashboard',
              },
            }),
          }
        );
        if (!createTbl.ok && createTbl.status !== 409) {
          throw new Error(
            `Error creando tabla ${def.tableId} en BigQuery: ${(createTbl.rawText || '').slice(
              0,
              250
            )}`
          );
        }
      }
    })
  );

  // 3. Create / update BI Views for Looker Studio unless explicitly skipped
  if (options?.includeViews !== false && process.env.BQ_ENSURE_VIEWS !== 'false') {
    const views = buildAnalyticalViewsSql(projectId, datasetId);
    for (const [viewName, viewQuery] of Object.entries(views)) {
      const viewCheck = await bqFetch(
        `/projects/${encodeURIComponent(projectId)}/datasets/${encodeURIComponent(
          datasetId
        )}/tables/${encodeURIComponent(viewName)}`
      );
      if (viewCheck.status === 404) {
        await bqFetch(
          `/projects/${encodeURIComponent(projectId)}/datasets/${encodeURIComponent(
            datasetId
          )}/tables`,
          {
            method: 'POST',
            body: JSON.stringify({
              tableReference: { projectId, datasetId, tableId: viewName },
              view: {
                query: viewQuery.trim(),
                useLegacySql: false,
              },
              labels: {
                app: 'skillsboost_dashboard',
                layer: 'bi_view',
              },
            }),
          }
        );
      }
    }
  }

  schemaVerifiedOnce = true;
  return { projectId, datasetId, location };
}

// ============================================================================
// Full Snapshot Persistence & Incremental MERGE into BigQuery
// ============================================================================
export async function persistSnapshotToBigQuery(
  payload: BigQuerySnapshotPayload,
  options?: { mergeActivities?: boolean }
): Promise<{ activitiesStored: number; syncId: string }> {
  const { projectId, datasetId, location } = await ensureBigQuerySchema();
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.slice(0, 10);
  const syncId = `sync-${Date.now()}`;

  // 1. Transform & deduplicate activities by deterministic activity_key
  const dedupActivities = new Map<string, Record<string, any>>();
  for (const a of payload.activities || []) {
    const key = computeActivityKey(a);
    const startedAt = parseIsoTimestamp(a['Date started']);
    const completedAt = parseIsoTimestamp(a['Date completed']);
    const activityDate =
      parseIsoDateOnly(a['Date completed']) ||
      parseIsoDateOnly(a['Date started']) ||
      todayDate;

    dedupActivities.set(key, {
      activity_key: key,
      activity_id: a.id || null,
      member_email: (a.Member || '').trim().toLowerCase(),
      member_name: a.memberName || null,
      team_slug: a.team_slug || null,
      team_name: a.team_name || null,
      content_id: a['Content ID'] || null,
      activity_name: a.Activity || null,
      activity_type: a['Activity Type'] || null,
      category: a.category || null,
      passed: a.Passed === 'true',
      given_score: parseOptionalNumber(a['Given Score']),
      maximum_score: parseOptionalNumber(a['Maximum Score']),
      given_score_raw: a['Given Score'] !== undefined ? String(a['Given Score']) : null,
      maximum_score_raw: a['Maximum Score'] !== undefined ? String(a['Maximum Score']) : null,
      learning_time_minutes: Number(a['Learning time (minutes)']) || 0,
      started_at: startedAt,
      completed_at: completedAt,
      activity_date: activityDate,
      content_url: a['Content Url'] || null,
      parent_type: a['Parent Type'] || null,
      parent_name: a['Parent Name'] || null,
      synced_at: nowIso,
    });
  }

  const activityRows = Array.from(dedupActivities.values());
  const useMerge =
    options?.mergeActivities !== undefined
      ? options.mergeActivities
      : payload.syncStatus.mode === 'live' && activityRows.length > 0;

  // 2. Transform Dimensions & App State
  const catalogRows = (payload.catalog || []).map((c) => ({
    content_id: c.content_id,
    content_type: c.content_type || 'Course',
    name: c.name || '',
    description: c.description || '',
    duration_minutes: c.duration ?? null,
    level: c.level || null,
    available_locales: Array.isArray(c.available_locales) ? c.available_locales : ['English'],
    url: c.url || '',
    category: c.category || 'Cloud Infrastructure',
    synced_at: nowIso,
  }));

  const teamRows = (payload.teams || []).map((t) => ({
    slug: t.slug,
    name: t.name || '',
    description: t.description || '',
    active: Boolean(t.active),
    member_count: t.member_count ?? 0,
    synced_at: nowIso,
  }));

  const memberRows = (payload.members || []).map((m) => ({
    email: (m.email || '').trim().toLowerCase(),
    first_name: m.first_name || '',
    last_name: m.last_name || '',
    status: m.status || 'active',
    team_slug: m.team_slug || null,
    team_name: m.team_name || null,
    synced_at: nowIso,
  }));

  const goalRows = (payload.goals || []).map((g) => ({
    id: g.id,
    team_slug: g.team_slug,
    title: g.title,
    target_hours_per_member: Number(g.targetHoursPerMember) || 0,
    target_adoption_rate: Number(g.targetAdoptionRate) || 0,
    target_category: g.targetCategory || null,
    target_category_completions: g.targetCategoryCompletions ?? null,
    quarter_label: g.quarterLabel,
    updated_at: nowIso,
  }));

  const curriculaRows = (payload.curricula || []).map((c) => ({
    id: c.id,
    target_role: c.targetRole,
    team_slug: c.team_slug,
    team_name: c.team_name || null,
    weeks_count: c.weeksCount || 4,
    hours_per_week: c.hoursPerWeek || 3,
    generated_by_model: c.generatedByModel || null,
    created_at: parseIsoTimestamp(c.createdAt) || nowIso,
    payload_json: JSON.stringify(c),
  }));

  // 3. Load Dimensions & App State in parallel via free BigQuery Load Jobs
  await Promise.all([
    runBqLoadJob(
      projectId,
      datasetId,
      location,
      BQ_TABLE_DEFINITIONS.dim_catalog,
      catalogRows,
      'WRITE_TRUNCATE'
    ),
    runBqLoadJob(
      projectId,
      datasetId,
      location,
      BQ_TABLE_DEFINITIONS.dim_teams,
      teamRows,
      'WRITE_TRUNCATE'
    ),
    runBqLoadJob(
      projectId,
      datasetId,
      location,
      BQ_TABLE_DEFINITIONS.dim_members,
      memberRows,
      'WRITE_TRUNCATE'
    ),
    runBqLoadJob(
      projectId,
      datasetId,
      location,
      BQ_TABLE_DEFINITIONS.app_goals_okrs,
      goalRows,
      'WRITE_TRUNCATE'
    ),
    runBqLoadJob(
      projectId,
      datasetId,
      location,
      BQ_TABLE_DEFINITIONS.app_ai_curricula,
      curriculaRows,
      'WRITE_TRUNCATE'
    ),
  ]);

  // 4. Persist Fact Activities (Idempotent MERGE via staging table for live mode, or WRITE_TRUNCATE for demo reset)
  if (useMerge) {
    const stagingDef: BigQueryTableDefinition = {
      ...BQ_TABLE_DEFINITIONS.fact_learning_activities,
      tableId: '_stg_learning_activities',
    };
    await runBqLoadJob(projectId, datasetId, location, stagingDef, activityRows, 'WRITE_TRUNCATE');

    const fqTarget = `\`${projectId}.${datasetId}.fact_learning_activities\``;
    const fqStage = `\`${projectId}.${datasetId}._stg_learning_activities\``;

    await runBigQuerySql(
      `
      MERGE ${fqTarget} T
      USING ${fqStage} S
      ON T.activity_key = S.activity_key
      WHEN MATCHED THEN UPDATE SET
        member_name = S.member_name,
        team_slug = S.team_slug,
        team_name = S.team_name,
        activity_name = S.activity_name,
        category = S.category,
        passed = S.passed,
        given_score = S.given_score,
        maximum_score = S.maximum_score,
        given_score_raw = S.given_score_raw,
        maximum_score_raw = S.maximum_score_raw,
        learning_time_minutes = S.learning_time_minutes,
        started_at = S.started_at,
        completed_at = S.completed_at,
        activity_date = S.activity_date,
        content_url = S.content_url,
        parent_type = S.parent_type,
        parent_name = S.parent_name,
        synced_at = S.synced_at
      WHEN NOT MATCHED THEN INSERT (
        activity_key, activity_id, member_email, member_name, team_slug, team_name,
        content_id, activity_name, activity_type, category, passed,
        given_score, maximum_score, given_score_raw, maximum_score_raw,
        learning_time_minutes, started_at, completed_at, activity_date,
        content_url, parent_type, parent_name, synced_at
      ) VALUES (
        S.activity_key, S.activity_id, S.member_email, S.member_name, S.team_slug, S.team_name,
        S.content_id, S.activity_name, S.activity_type, S.category, S.passed,
        S.given_score, S.maximum_score, S.given_score_raw, S.maximum_score_raw,
        S.learning_time_minutes, S.started_at, S.completed_at, S.activity_date,
        S.content_url, S.parent_type, S.parent_name, S.synced_at
      )
      `,
      undefined,
      { projectId, location }
    );
  } else {
    await runBqLoadJob(
      projectId,
      datasetId,
      location,
      BQ_TABLE_DEFINITIONS.fact_learning_activities,
      activityRows,
      'WRITE_TRUNCATE'
    );
  }

  // 5. Append Historical Org Stats Snapshot (Time-series tracking of seats & badges)
  if (payload.orgStats) {
    const snapRow = {
      snapshot_id: `snap-${Date.now()}`,
      snapshot_date: todayDate,
      fetched_at: parseIsoTimestamp(payload.orgStats.fetchedAt) || nowIso,
      organization_slug: payload.apiConfig?.organizationSlug || null,
      contracted_licenses: payload.apiConfig?.contractedLicenses || 500,
      accepted_invitations: payload.orgStats.accepted_invitations || 0,
      pending_invitations: payload.orgStats.pending_invitations || 0,
      cumulative_learners: payload.orgStats.cumulative_learners || 0,
      labs_started: payload.orgStats.labs_started || 0,
      courses_enrolled: payload.orgStats.courses_enrolled || 0,
      labs_passed: payload.orgStats.labs_passed || 0,
      courses_completed: payload.orgStats.courses_completed || 0,
      skills_badges_earned: payload.orgStats.skills_badges_earned || 0,
      window_start: payload.orgStats.startDate || null,
      window_end: payload.orgStats.endDate || null,
    };
    await runBqLoadJob(
      projectId,
      datasetId,
      location,
      BQ_TABLE_DEFINITIONS.fact_org_stats_snapshots,
      [snapRow],
      'WRITE_APPEND'
    );
  }

  // 6. Record Sync Audit Marker
  await runBqLoadJob(
    projectId,
    datasetId,
    location,
    BQ_TABLE_DEFINITIONS.sync_audit_log,
    [
      {
        sync_id: syncId,
        sync_date: todayDate,
        synced_at: parseIsoTimestamp(payload.syncStatus.lastSyncAt) || nowIso,
        mode: payload.syncStatus.mode || 'demo',
        status: payload.syncStatus.status || 'success',
        message: payload.syncStatus.message || '',
        organization_slug: payload.apiConfig?.organizationSlug || null,
        contracted_licenses: payload.apiConfig?.contractedLicenses || 500,
        catalog_count: catalogRows.length,
        teams_count: teamRows.length,
        members_count: memberRows.length,
        activities_count: activityRows.length,
      },
    ],
    'WRITE_APPEND'
  );

  return { activitiesStored: activityRows.length, syncId };
}

// ============================================================================
// Fast Granular Mutations (OKRs, AI Curricula & Contracted Licenses)
// ============================================================================
export async function upsertGoalInBigQuery(goal: TeamGoalConfig): Promise<void> {
  const { projectId, datasetId, location } = await ensureBigQuerySchema();
  const fq = `\`${projectId}.${datasetId}.app_goals_okrs\``;
  await runBigQuerySql(
    `
    MERGE ${fq} T
    USING (SELECT @id AS id) S
    ON T.id = S.id
    WHEN MATCHED THEN UPDATE SET
      team_slug = @team_slug,
      title = @title,
      target_hours_per_member = @target_hours,
      target_adoption_rate = @target_adoption,
      target_category = @target_category,
      target_category_completions = @target_completions,
      quarter_label = @quarter_label,
      updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
      id, team_slug, title, target_hours_per_member, target_adoption_rate,
      target_category, target_category_completions, quarter_label, updated_at
    ) VALUES (
      @id, @team_slug, @title, @target_hours, @target_adoption,
      @target_category, @target_completions, @quarter_label, CURRENT_TIMESTAMP()
    )
    `,
    {
      id: { type: 'STRING', value: goal.id },
      team_slug: { type: 'STRING', value: goal.team_slug },
      title: { type: 'STRING', value: goal.title },
      target_hours: { type: 'FLOAT64', value: goal.targetHoursPerMember },
      target_adoption: { type: 'FLOAT64', value: goal.targetAdoptionRate },
      target_category: { type: 'STRING', value: goal.targetCategory ?? null },
      target_completions: { type: 'INT64', value: goal.targetCategoryCompletions ?? null },
      quarter_label: { type: 'STRING', value: goal.quarterLabel },
    },
    { projectId, location }
  );
}

export async function deleteGoalInBigQuery(goalId: string): Promise<void> {
  const { projectId, datasetId, location } = await ensureBigQuerySchema();
  const fq = `\`${projectId}.${datasetId}.app_goals_okrs\``;
  await runBigQuerySql(
    `DELETE FROM ${fq} WHERE id = @id`,
    { id: { type: 'STRING', value: goalId } },
    { projectId, location }
  );
}

export async function upsertCurriculumInBigQuery(plan: CurriculumPlan): Promise<void> {
  const { projectId, datasetId, location } = await ensureBigQuerySchema();
  const fq = `\`${projectId}.${datasetId}.app_ai_curricula\``;
  await runBigQuerySql(
    `
    MERGE ${fq} T
    USING (SELECT @id AS id) S
    ON T.id = S.id
    WHEN MATCHED THEN UPDATE SET
      target_role = @target_role,
      team_slug = @team_slug,
      team_name = @team_name,
      weeks_count = @weeks_count,
      hours_per_week = @hours_per_week,
      generated_by_model = @generated_by_model,
      payload_json = @payload_json
    WHEN NOT MATCHED THEN INSERT (
      id, target_role, team_slug, team_name, weeks_count, hours_per_week,
      generated_by_model, created_at, payload_json
    ) VALUES (
      @id, @target_role, @team_slug, @team_name, @weeks_count, @hours_per_week,
      @generated_by_model, CURRENT_TIMESTAMP(), @payload_json
    )
    `,
    {
      id: { type: 'STRING', value: plan.id },
      target_role: { type: 'STRING', value: plan.targetRole },
      team_slug: { type: 'STRING', value: plan.team_slug },
      team_name: { type: 'STRING', value: plan.team_name },
      weeks_count: { type: 'INT64', value: plan.weeksCount },
      hours_per_week: { type: 'FLOAT64', value: plan.hoursPerWeek },
      generated_by_model: { type: 'STRING', value: plan.generatedByModel },
      payload_json: { type: 'STRING', value: JSON.stringify(plan) },
    },
    { projectId, location }
  );
}

export async function deleteCurriculumInBigQuery(curriculumId: string): Promise<void> {
  const { projectId, datasetId, location } = await ensureBigQuerySchema();
  const fq = `\`${projectId}.${datasetId}.app_ai_curricula\``;
  await runBigQuerySql(
    `DELETE FROM ${fq} WHERE id = @id`,
    { id: { type: 'STRING', value: curriculumId } },
    { projectId, location }
  );
}

// ============================================================================
// High-Throughput Column-Pruned Hydration from BigQuery to Cloud Run RAM
// ============================================================================
export async function fetchLatestBigQuerySyncMarker(): Promise<{
  syncId: string;
  syncedAt: string;
} | null> {
  const rt = getRuntimeStorageConfig();
  if (!rt.bqProjectId) return null;

  try {
    const fq = `\`${rt.bqProjectId}.${rt.bqDatasetId}.sync_audit_log\``;
    const rows = await runBigQuerySql<{ sync_id: string; synced_at: string }>(
      `SELECT sync_id, synced_at FROM ${fq} ORDER BY synced_at DESC LIMIT 1`
    );
    if (!rows.length) return null;
    return { syncId: rows[0].sync_id, syncedAt: rows[0].synced_at };
  } catch {
    return null;
  }
}

export async function loadSnapshotFromBigQuery(): Promise<{
  snapshot: BigQuerySnapshotPayload;
  syncMarker: string | null;
} | null> {
  const { projectId, datasetId } = await ensureBigQuerySchema();
  const fq = (tbl: string) => `\`${projectId}.${datasetId}.${tbl}\``;

  const [auditRows, catalogRows, teamRows, memberRows, activityRows, statsRows, goalRows, currRows] =
    await Promise.all([
      runBigQuerySql<any>(
        `SELECT sync_id, synced_at, mode, status, message, organization_slug, contracted_licenses
         FROM ${fq('sync_audit_log')}
         ORDER BY synced_at DESC
         LIMIT 1`
      ),
      runBigQuerySql<any>(
        `SELECT content_id, content_type, name, description, duration_minutes, level, available_locales, url, category
         FROM ${fq('dim_catalog')}`
      ),
      runBigQuerySql<any>(
        `SELECT slug, name, description, active, member_count
         FROM ${fq('dim_teams')}`
      ),
      runBigQuerySql<any>(
        `SELECT email, first_name, last_name, status, team_slug, team_name
         FROM ${fq('dim_members')}`
      ),
      runBigQuerySql<any>(
        `SELECT activity_id, member_email, member_name, team_slug, team_name,
                content_id, activity_name, activity_type, category, passed,
                given_score_raw, given_score, maximum_score_raw, maximum_score,
                learning_time_minutes, started_at, completed_at, content_url,
                parent_type, parent_name
         FROM ${fq('fact_learning_activities')}`
      ),
      runBigQuerySql<any>(
        `SELECT accepted_invitations, pending_invitations, cumulative_learners,
                labs_started, courses_enrolled, labs_passed, courses_completed,
                skills_badges_earned, window_start, window_end, fetched_at
         FROM ${fq('fact_org_stats_snapshots')}
         ORDER BY fetched_at DESC
         LIMIT 1`
      ),
      runBigQuerySql<any>(
        `SELECT id, team_slug, title, target_hours_per_member, target_adoption_rate,
                target_category, target_category_completions, quarter_label
         FROM ${fq('app_goals_okrs')}`
      ),
      runBigQuerySql<any>(
        `SELECT payload_json
         FROM ${fq('app_ai_curricula')}
         ORDER BY created_at DESC
         LIMIT 20`
      ),
    ]);

  // Empty warehouse on first boot
  if (auditRows.length === 0 && activityRows.length === 0 && catalogRows.length === 0) {
    return null;
  }

  const latestAudit = auditRows[0];

  const catalog: CatalogItem[] = catalogRows.map((r) => ({
    content_id: r.content_id || '',
    content_type: (r.content_type || 'Course') as CatalogItem['content_type'],
    name: r.name || '',
    description: r.description || '',
    duration: r.duration_minutes ?? null,
    level: r.level || null,
    available_locales: Array.isArray(r.available_locales) ? r.available_locales : ['English'],
    url: r.url || '',
    category: r.category || 'Cloud Infrastructure',
  }));

  const teams: Team[] = teamRows.map((r) => ({
    slug: r.slug || '',
    name: r.name || '',
    description: r.description || '',
    active: r.active !== false,
    member_count: r.member_count ?? 0,
  }));

  const members: Member[] = memberRows.map((r) => ({
    email: r.email || '',
    first_name: r.first_name || '',
    last_name: r.last_name || '',
    status: (r.status || 'active') as Member['status'],
    team_slug: r.team_slug || undefined,
    team_name: r.team_name || undefined,
  }));

  const activities: LearningActivity[] = activityRows.map((r, idx) => ({
    id: r.activity_id || `act-bq-${idx + 1}`,
    Member: r.member_email || '',
    memberName: r.member_name || undefined,
    team_slug: r.team_slug || undefined,
    team_name: r.team_name || undefined,
    'Content ID': r.content_id || '',
    Activity: r.activity_name || '',
    'Activity Type': (r.activity_type || 'Course') as LearningActivity['Activity Type'],
    category: r.category || 'Cloud Infrastructure',
    Passed: r.passed ? 'true' : 'false',
    'Given Score':
      r.given_score_raw ?? (r.given_score !== null && r.given_score !== undefined ? String(r.given_score) : ''),
    'Maximum Score':
      r.maximum_score_raw ??
      (r.maximum_score !== null && r.maximum_score !== undefined ? String(r.maximum_score) : ''),
    'Learning time (minutes)': Number(r.learning_time_minutes) || 0,
    'Date started': r.started_at || '',
    'Date completed': r.completed_at || '',
    'Content Url': r.content_url || undefined,
    'Parent Type': r.parent_type || undefined,
    'Parent Name': r.parent_name || undefined,
  }));

  const latestStats = statsRows[0];
  const orgStats: OrganizationOfficialStats | undefined = latestStats
    ? {
        accepted_invitations: Number(latestStats.accepted_invitations) || 0,
        pending_invitations: Number(latestStats.pending_invitations) || 0,
        cumulative_learners: Number(latestStats.cumulative_learners) || 0,
        labs_started: Number(latestStats.labs_started) || 0,
        courses_enrolled: Number(latestStats.courses_enrolled) || 0,
        labs_passed: Number(latestStats.labs_passed) || 0,
        courses_completed: Number(latestStats.courses_completed) || 0,
        skills_badges_earned: Number(latestStats.skills_badges_earned) || 0,
        startDate: latestStats.window_start || undefined,
        endDate: latestStats.window_end || undefined,
        fetchedAt: latestStats.fetched_at || undefined,
      }
    : undefined;

  const goals: TeamGoalConfig[] = goalRows.map((g) => ({
    id: g.id,
    team_slug: g.team_slug,
    title: g.title,
    targetHoursPerMember: Number(g.target_hours_per_member) || 5,
    targetAdoptionRate: Number(g.target_adoption_rate) || 60,
    targetCategory: g.target_category || undefined,
    targetCategoryCompletions:
      g.target_category_completions !== null && g.target_category_completions !== undefined
        ? Number(g.target_category_completions)
        : undefined,
    quarterLabel: g.quarter_label || 'Q4 2026',
  }));

  const curricula: CurriculumPlan[] = [];
  for (const row of currRows) {
    if (row.payload_json) {
      try {
        curricula.push(JSON.parse(row.payload_json));
      } catch {
        // ignore malformed row
      }
    }
  }

  const contractedLicenses =
    Number(latestAudit?.contracted_licenses) ||
    Number(process.env.SKILLS_CONTRACTED_LICENSES) ||
    500;

  const mode = (latestAudit?.mode === 'live' ? 'live' : 'demo') as 'live' | 'demo';

  const snapshot: BigQuerySnapshotPayload = {
    apiConfig: {
      baseUrl: process.env.SKILLS_API_BASE_URL || 'https://www.skills.google/api/v2',
      accessKey: process.env.SKILLS_ACCESS_KEY || '',
      secretKey: process.env.SKILLS_SECRET_KEY || '',
      organizationSlug:
        process.env.SKILLS_ORGANIZATION_SLUG || latestAudit?.organization_slug || '',
      contractedLicenses,
    },
    orgStats,
    catalog,
    teams,
    members,
    activities,
    goals,
    curricula,
    syncStatus: {
      lastSyncAt: latestAudit?.synced_at || new Date().toISOString(),
      mode,
      status: (latestAudit?.status as SyncStatus['status']) || 'success',
      message:
        latestAudit?.message ||
        `Datos hidratados desde BigQuery (${projectId}.${datasetId})`,
      counts: {
        catalog: catalog.length,
        teams: teams.length,
        members: mode === 'live' ? contractedLicenses : members.length,
        activities: activities.length,
      },
    },
  };

  return {
    snapshot,
    syncMarker: latestAudit?.sync_id || null,
  };
}
