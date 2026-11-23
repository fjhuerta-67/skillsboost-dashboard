-- ============================================================================
-- Google Skills for Organizations Dashboard — BigQuery Analytical Views (BI)
-- Dataset por defecto: skillsboost_analytics
-- Reemplaza PROJECT_ID y DATASET_ID si ejecutas este archivo manualmente en la
-- Consola de BigQuery (Terraform y el adaptador los crean automáticamente).
-- ============================================================================

-- 1. Vista Ejecutiva Mensual de KPIs (Ideal para gráficos de tendencia en Looker Studio)
CREATE OR REPLACE VIEW `PROJECT_ID.DATASET_ID.vw_executive_kpis` AS
WITH monthly_base AS (
  SELECT
    DATE_TRUNC(COALESCE(DATE(completed_at), DATE(started_at), activity_date), MONTH) AS activity_month,
    member_email,
    activity_type,
    passed,
    COALESCE(learning_time_minutes, 0) / 60.0 AS hours_spent
  FROM `PROJECT_ID.DATASET_ID.fact_learning_activities`
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
GROUP BY activity_month;

-- 2. Vista de Adopción de Licencias, Retención y Riesgo de Abandono (ROI)
CREATE OR REPLACE VIEW `PROJECT_ID.DATASET_ID.vw_license_adoption_roi` AS
WITH learner_agg AS (
  SELECT
    LOWER(member_email) AS email,
    ANY_VALUE(member_name) AS fallback_name,
    ANY_VALUE(team_name) AS fallback_team_name,
    COUNT(*) AS activities_started,
    COUNTIF(passed IS TRUE) AS activities_completed,
    ROUND(SUM(COALESCE(learning_time_minutes, 0)) / 60.0, 2) AS hours_spent,
    MAX(COALESCE(completed_at, started_at)) AS last_activity_at,
    COUNTIF(
      EXTRACT(YEAR FROM COALESCE(completed_at, started_at)) = EXTRACT(YEAR FROM CURRENT_TIMESTAMP())
    ) AS current_year_activities
  FROM `PROJECT_ID.DATASET_ID.fact_learning_activities`
  GROUP BY LOWER(member_email)
),
roster_dedup AS (
  SELECT
    LOWER(email) AS email,
    ANY_VALUE(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS full_name,
    ANY_VALUE(status) AS invite_status,
    ANY_VALUE(team_slug) AS team_slug,
    ANY_VALUE(team_name) AS team_name
  FROM `PROJECT_ID.DATASET_ID.dim_members`
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
  ON r.email = a.email;

-- 3. Matriz de Madurez Técnica por Equipo y Categoría Cloud
CREATE OR REPLACE VIEW `PROJECT_ID.DATASET_ID.vw_team_skill_matrix` AS
SELECT
  COALESCE(team_slug, 'organizacion-general') AS team_slug,
  COALESCE(team_name, 'Organización General (Sin Equipo)') AS team_name,
  COALESCE(category, 'Cloud Infrastructure') AS skill_category,
  COUNT(DISTINCT LOWER(member_email)) AS active_learners,
  COUNT(*) AS activities_started,
  COUNTIF(passed IS TRUE) AS activities_passed,
  ROUND(SUM(COALESCE(learning_time_minutes, 0)) / 60.0, 2) AS hours_trained
FROM `PROJECT_ID.DATASET_ID.fact_learning_activities`
GROUP BY 1, 2, 3;

-- 4. Candidatos Elegibles para Voucher de Certificación Oficial
CREATE OR REPLACE VIEW `PROJECT_ID.DATASET_ID.vw_certification_candidates` AS
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
  FROM `PROJECT_ID.DATASET_ID.fact_learning_activities`
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
WHERE passed_modules >= 1;
