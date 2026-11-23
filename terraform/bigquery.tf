# ============================================================================
# Google BigQuery Data Warehouse — Dataset, 8 Tablas y 4 Vistas BI (Looker)
# ============================================================================

resource "google_bigquery_dataset" "analytics" {
  dataset_id  = var.bq_dataset_id
  location    = local.bq_location
  description = "Data Warehouse Analítico y Operativo — Google Skills for Organizations Dashboard"
  labels      = local.common_labels

  depends_on = [google_project_service.apis]
}

# 1. Tabla de Hechos Principal (Particionada por MES y Clusterizada)
resource "google_bigquery_table" "fact_learning_activities" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "fact_learning_activities"
  description         = "Tabla de hechos histórica de actividades de capacitación sincronizadas desde Google Skills API v2."
  deletion_protection = var.bq_deletion_protection
  labels              = local.common_labels

  time_partitioning {
    type  = "MONTH"
    field = "activity_date"
  }

  clustering = ["team_slug", "category", "activity_type", "member_email"]

  schema = jsonencode([
    { name = "activity_key", type = "STRING", mode = "REQUIRED", description = "Llave determinística SHA-256 para deduplicación incremental (MERGE)." },
    { name = "activity_id", type = "STRING", mode = "NULLABLE" },
    { name = "member_email", type = "STRING", mode = "REQUIRED" },
    { name = "member_name", type = "STRING", mode = "NULLABLE" },
    { name = "team_slug", type = "STRING", mode = "NULLABLE" },
    { name = "team_name", type = "STRING", mode = "NULLABLE" },
    { name = "content_id", type = "STRING", mode = "NULLABLE" },
    { name = "activity_name", type = "STRING", mode = "NULLABLE" },
    { name = "activity_type", type = "STRING", mode = "NULLABLE" },
    { name = "category", type = "STRING", mode = "NULLABLE" },
    { name = "passed", type = "BOOL", mode = "NULLABLE" },
    { name = "given_score", type = "FLOAT64", mode = "NULLABLE" },
    { name = "maximum_score", type = "FLOAT64", mode = "NULLABLE" },
    { name = "given_score_raw", type = "STRING", mode = "NULLABLE" },
    { name = "maximum_score_raw", type = "STRING", mode = "NULLABLE" },
    { name = "learning_time_minutes", type = "FLOAT64", mode = "NULLABLE" },
    { name = "started_at", type = "TIMESTAMP", mode = "NULLABLE" },
    { name = "completed_at", type = "TIMESTAMP", mode = "NULLABLE" },
    { name = "activity_date", type = "DATE", mode = "NULLABLE", description = "Fecha base de particionamiento mensual." },
    { name = "content_url", type = "STRING", mode = "NULLABLE" },
    { name = "parent_type", type = "STRING", mode = "NULLABLE" },
    { name = "parent_name", type = "STRING", mode = "NULLABLE" },
    { name = "synced_at", type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

# 2. Dimensión Catálogo
resource "google_bigquery_table" "dim_catalog" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "dim_catalog"
  description         = "Dimensión del catálogo oficial de cursos, rutas, laboratorios y certificaciones."
  deletion_protection = var.bq_deletion_protection
  labels              = local.common_labels
  clustering          = ["category", "content_type", "level"]

  schema = jsonencode([
    { name = "content_id", type = "STRING", mode = "REQUIRED" },
    { name = "content_type", type = "STRING", mode = "NULLABLE" },
    { name = "name", type = "STRING", mode = "NULLABLE" },
    { name = "description", type = "STRING", mode = "NULLABLE" },
    { name = "duration_minutes", type = "INT64", mode = "NULLABLE" },
    { name = "level", type = "STRING", mode = "NULLABLE" },
    { name = "available_locales", type = "STRING", mode = "REPEATED" },
    { name = "url", type = "STRING", mode = "NULLABLE" },
    { name = "category", type = "STRING", mode = "NULLABLE" },
    { name = "synced_at", type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

# 3. Dimensión Equipos
resource "google_bigquery_table" "dim_teams" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "dim_teams"
  description         = "Dimensión de equipos configurados en Google Skills for Organizations."
  deletion_protection = var.bq_deletion_protection
  labels              = local.common_labels

  schema = jsonencode([
    { name = "slug", type = "STRING", mode = "REQUIRED" },
    { name = "name", type = "STRING", mode = "NULLABLE" },
    { name = "description", type = "STRING", mode = "NULLABLE" },
    { name = "active", type = "BOOL", mode = "NULLABLE" },
    { name = "member_count", type = "INT64", mode = "NULLABLE" },
    { name = "synced_at", type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

# 4. Dimensión Miembros
resource "google_bigquery_table" "dim_members" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "dim_members"
  description         = "Dimensión de colaboradores asignados a equipos y estado de invitación."
  deletion_protection = var.bq_deletion_protection
  labels              = local.common_labels
  clustering          = ["team_slug", "status"]

  schema = jsonencode([
    { name = "email", type = "STRING", mode = "REQUIRED" },
    { name = "first_name", type = "STRING", mode = "NULLABLE" },
    { name = "last_name", type = "STRING", mode = "NULLABLE" },
    { name = "status", type = "STRING", mode = "NULLABLE" },
    { name = "team_slug", type = "STRING", mode = "NULLABLE" },
    { name = "team_name", type = "STRING", mode = "NULLABLE" },
    { name = "synced_at", type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

# 5. Serie Histórica Oficial de Licencias y Estadísticas (/stats)
resource "google_bigquery_table" "fact_org_stats_snapshots" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "fact_org_stats_snapshots"
  description         = "Serie histórica de instantáneas oficiales (/organizations/{slug}/stats) para seguimiento de licencias y badges."
  deletion_protection = var.bq_deletion_protection
  labels              = local.common_labels

  time_partitioning {
    type  = "MONTH"
    field = "snapshot_date"
  }

  schema = jsonencode([
    { name = "snapshot_id", type = "STRING", mode = "REQUIRED" },
    { name = "snapshot_date", type = "DATE", mode = "REQUIRED" },
    { name = "fetched_at", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "organization_slug", type = "STRING", mode = "NULLABLE" },
    { name = "contracted_licenses", type = "INT64", mode = "NULLABLE" },
    { name = "accepted_invitations", type = "INT64", mode = "NULLABLE" },
    { name = "pending_invitations", type = "INT64", mode = "NULLABLE" },
    { name = "cumulative_learners", type = "INT64", mode = "NULLABLE" },
    { name = "labs_started", type = "INT64", mode = "NULLABLE" },
    { name = "courses_enrolled", type = "INT64", mode = "NULLABLE" },
    { name = "labs_passed", type = "INT64", mode = "NULLABLE" },
    { name = "courses_completed", type = "INT64", mode = "NULLABLE" },
    { name = "skills_badges_earned", type = "INT64", mode = "NULLABLE" },
    { name = "window_start", type = "STRING", mode = "NULLABLE" },
    { name = "window_end", type = "STRING", mode = "NULLABLE" }
  ])
}

# 6. Estado Operativo: OKRs Trimestrales
resource "google_bigquery_table" "app_goals_okrs" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "app_goals_okrs"
  description         = "Metas trimestrales y OKRs configurados en el tablero ejecutivo."
  deletion_protection = var.bq_deletion_protection
  labels              = local.common_labels

  schema = jsonencode([
    { name = "id", type = "STRING", mode = "REQUIRED" },
    { name = "team_slug", type = "STRING", mode = "REQUIRED" },
    { name = "title", type = "STRING", mode = "REQUIRED" },
    { name = "target_hours_per_member", type = "FLOAT64", mode = "REQUIRED" },
    { name = "target_adoption_rate", type = "FLOAT64", mode = "REQUIRED" },
    { name = "target_category", type = "STRING", mode = "NULLABLE" },
    { name = "target_category_completions", type = "INT64", mode = "NULLABLE" },
    { name = "quarter_label", type = "STRING", mode = "REQUIRED" },
    { name = "updated_at", type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

# 7. Estado Operativo: Planes Curriculares con IA
resource "google_bigquery_table" "app_ai_curricula" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "app_ai_curricula"
  description         = "Planes curriculares generados con Gemini IA para equipos de la organización."
  deletion_protection = var.bq_deletion_protection
  labels              = local.common_labels

  schema = jsonencode([
    { name = "id", type = "STRING", mode = "REQUIRED" },
    { name = "target_role", type = "STRING", mode = "REQUIRED" },
    { name = "team_slug", type = "STRING", mode = "REQUIRED" },
    { name = "team_name", type = "STRING", mode = "NULLABLE" },
    { name = "weeks_count", type = "INT64", mode = "NULLABLE" },
    { name = "hours_per_week", type = "FLOAT64", mode = "NULLABLE" },
    { name = "generated_by_model", type = "STRING", mode = "NULLABLE" },
    { name = "created_at", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "payload_json", type = "STRING", mode = "REQUIRED" }
  ])
}

# 8. Bitácora de Sincronización y Control de Caché
resource "google_bigquery_table" "sync_audit_log" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "sync_audit_log"
  description         = "Bitácora de sincronizaciones y metadatos de control de caché multi-instancia."
  deletion_protection = var.bq_deletion_protection
  labels              = local.common_labels

  time_partitioning {
    type  = "MONTH"
    field = "sync_date"
  }

  schema = jsonencode([
    { name = "sync_id", type = "STRING", mode = "REQUIRED" },
    { name = "sync_date", type = "DATE", mode = "REQUIRED" },
    { name = "synced_at", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "mode", type = "STRING", mode = "REQUIRED" },
    { name = "status", type = "STRING", mode = "REQUIRED" },
    { name = "message", type = "STRING", mode = "NULLABLE" },
    { name = "organization_slug", type = "STRING", mode = "NULLABLE" },
    { name = "contracted_licenses", type = "INT64", mode = "NULLABLE" },
    { name = "catalog_count", type = "INT64", mode = "NULLABLE" },
    { name = "teams_count", type = "INT64", mode = "NULLABLE" },
    { name = "members_count", type = "INT64", mode = "NULLABLE" },
    { name = "activities_count", type = "INT64", mode = "NULLABLE" }
  ])
}

# ============================================================================
# Vistas Analíticas Listas para Looker Studio / Connected Sheets
# ============================================================================

resource "google_bigquery_table" "vw_executive_kpis" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "vw_executive_kpis"
  deletion_protection = false
  labels              = merge(local.common_labels, { layer = "bi_view" })

  view {
    use_legacy_sql = false
    query          = <<-SQL
      WITH monthly_base AS (
        SELECT
          DATE_TRUNC(COALESCE(DATE(completed_at), DATE(started_at), activity_date), MONTH) AS activity_month,
          member_email,
          activity_type,
          passed,
          COALESCE(learning_time_minutes, 0) / 60.0 AS hours_spent
        FROM `${var.project_id}.${var.bq_dataset_id}.fact_learning_activities`
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
      GROUP BY activity_month
    SQL
  }

  depends_on = [google_bigquery_table.fact_learning_activities]
}

resource "google_bigquery_table" "vw_license_adoption_roi" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "vw_license_adoption_roi"
  deletion_protection = false
  labels              = merge(local.common_labels, { layer = "bi_view" })

  view {
    use_legacy_sql = false
    query          = <<-SQL
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
        FROM `${var.project_id}.${var.bq_dataset_id}.fact_learning_activities`
        GROUP BY LOWER(member_email)
      ),
      roster_dedup AS (
        SELECT
          LOWER(email) AS email,
          ANY_VALUE(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS full_name,
          ANY_VALUE(status) AS invite_status,
          ANY_VALUE(team_slug) AS team_slug,
          ANY_VALUE(team_name) AS team_name
        FROM `${var.project_id}.${var.bq_dataset_id}.dim_members`
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
        ON r.email = a.email
    SQL
  }

  depends_on = [
    google_bigquery_table.fact_learning_activities,
    google_bigquery_table.dim_members
  ]
}

resource "google_bigquery_table" "vw_team_skill_matrix" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "vw_team_skill_matrix"
  deletion_protection = false
  labels              = merge(local.common_labels, { layer = "bi_view" })

  view {
    use_legacy_sql = false
    query          = <<-SQL
      SELECT
        COALESCE(team_slug, 'organizacion-general') AS team_slug,
        COALESCE(team_name, 'Organización General (Sin Equipo)') AS team_name,
        COALESCE(category, 'Cloud Infrastructure') AS skill_category,
        COUNT(DISTINCT LOWER(member_email)) AS active_learners,
        COUNT(*) AS activities_started,
        COUNTIF(passed IS TRUE) AS activities_passed,
        ROUND(SUM(COALESCE(learning_time_minutes, 0)) / 60.0, 2) AS hours_trained
      FROM `${var.project_id}.${var.bq_dataset_id}.fact_learning_activities`
      GROUP BY 1, 2, 3
    SQL
  }

  depends_on = [google_bigquery_table.fact_learning_activities]
}

resource "google_bigquery_table" "vw_certification_candidates" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "vw_certification_candidates"
  deletion_protection = false
  labels              = merge(local.common_labels, { layer = "bi_view" })

  view {
    use_legacy_sql = false
    query          = <<-SQL
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
        FROM `${var.project_id}.${var.bq_dataset_id}.fact_learning_activities`
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
      WHERE passed_modules >= 1
    SQL
  }

  depends_on = [google_bigquery_table.fact_learning_activities]
}
