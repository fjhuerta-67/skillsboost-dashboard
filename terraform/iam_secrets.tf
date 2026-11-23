# ============================================================================
# Cuentas de Servicio de Privilegio Mínimo (Least-Privilege IAM)
# ============================================================================

resource "google_service_account" "web_runtime" {
  account_id   = "skillsboost-web-sa"
  display_name = "SkillsBoost Dashboard — Cloud Run Web Service"
  description  = "Identidad de ejecución para el portal ejecutivo de Google Skills en Cloud Run."
  depends_on   = [google_project_service.apis]
}

resource "google_service_account" "sync_worker" {
  account_id   = "skillsboost-sync-sa"
  display_name = "SkillsBoost Dashboard — Cloud Run Sync Job"
  description  = "Identidad para el worker nocturno de sincronización hacia BigQuery y GCS."
  depends_on   = [google_project_service.apis]
}

resource "google_service_account" "scheduler_invoker" {
  account_id   = "skillsboost-sched-sa"
  display_name = "SkillsBoost Dashboard — Cloud Scheduler Invoker"
  description  = "Identidad exclusiva para disparar el Cloud Run Job desde Cloud Scheduler."
  depends_on   = [google_project_service.apis]
}

# Permisos para ejecutar Jobs de consulta/carga en BigQuery a nivel proyecto
resource "google_project_iam_member" "web_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.web_runtime.email}"
}

resource "google_project_iam_member" "sync_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.sync_worker.email}"
}

# Permisos de datos acotados exclusivamente al Dataset de SkillsBoost
resource "google_bigquery_dataset_iam_member" "web_bq_data_editor" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.web_runtime.email}"
}

resource "google_bigquery_dataset_iam_member" "sync_bq_data_editor" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.sync_worker.email}"
}

# Permiso para invocar modelos Gemini en Vertex AI vía ADC
resource "google_project_iam_member" "web_vertex_ai_user" {
  count   = var.use_vertex_ai ? 1 : 0
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.web_runtime.email}"
}

# ============================================================================
# Contenedores en Google Secret Manager
# Nota de Seguridad: Las claves reales de usuario se cargan mediante el wizard
# interactivo o 'gcloud secrets versions add' para no exponerlas en Git/State.
# ============================================================================

resource "google_secret_manager_secret" "skills_access_key" {
  secret_id = "skillsboost-access-key"
  labels    = local.common_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "skills_secret_key" {
  secret_id = "skillsboost-secret-key"
  labels    = local.common_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "skillsboost-gemini-api-key"
  labels    = local.common_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "dashboard_password" {
  secret_id = "skillsboost-access-password"
  labels    = local.common_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

# Token interno autogenerado para webhook seguro entre Sync Job -> Web Service
resource "random_password" "cron_refresh_token" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret" "cron_refresh_token" {
  secret_id = "skillsboost-cron-refresh-token"
  labels    = local.common_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "cron_refresh_token_v1" {
  secret      = google_secret_manager_secret.cron_refresh_token.id
  secret_data = random_password.cron_refresh_token.result
}

locals {
  managed_secrets = {
    access_key         = google_secret_manager_secret.skills_access_key.secret_id
    secret_key         = google_secret_manager_secret.skills_secret_key.secret_id
    gemini_api_key     = google_secret_manager_secret.gemini_api_key.secret_id
    dashboard_password = google_secret_manager_secret.dashboard_password.secret_id
    cron_refresh_token = google_secret_manager_secret.cron_refresh_token.secret_id
  }
}

resource "google_secret_manager_secret_iam_member" "web_secret_accessor" {
  for_each  = local.managed_secrets
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web_runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "sync_secret_accessor" {
  for_each = {
    access_key         = google_secret_manager_secret.skills_access_key.secret_id
    secret_key         = google_secret_manager_secret.skills_secret_key.secret_id
    cron_refresh_token = google_secret_manager_secret.cron_refresh_token.secret_id
  }
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.sync_worker.email}"
}
