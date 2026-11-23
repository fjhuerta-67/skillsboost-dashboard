# ============================================================================
# Artifact Registry, Cloud Storage Cache, Cloud Run Service, Sync Job & Cron
# ============================================================================

resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = var.artifact_repo_id
  description   = "Repositorio de imágenes Docker — SkillsBoost Dashboard"
  format        = "DOCKER"
  labels        = local.common_labels

  depends_on = [google_project_service.apis]
}

# Bucket privado opcional para respaldo comprimido (store.json.gz)
resource "google_storage_bucket" "data_cache" {
  count                       = var.create_gcs_bucket ? 1 : 0
  name                        = local.gcs_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  labels                      = local.common_labels

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket_iam_member" "web_gcs_admin" {
  count  = var.create_gcs_bucket ? 1 : 0
  bucket = google_storage_bucket.data_cache[0].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.web_runtime.email}"
}

resource "google_storage_bucket_iam_member" "sync_gcs_admin" {
  count  = var.create_gcs_bucket ? 1 : 0
  bucket = google_storage_bucket.data_cache[0].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.sync_worker.email}"
}

# ============================================================================
# Cloud Run v2 Service — Portal Web Ejecutivo (Express + React 15 Módulos)
# ============================================================================

resource "google_cloud_run_v2_service" "dashboard" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = local.common_labels

  template {
    service_account                  = google_service_account.web_runtime.email
    timeout                          = "900s"
    max_instance_request_concurrency = 80

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = local.resolved_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cpu_limit
          memory = var.memory_limit
        }
        cpu_idle = false
      }

      startup_probe {
        initial_delay_seconds = 3
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 6
        http_get {
          path = "/healthz"
          port = 8080
        }
      }

      liveness_probe {
        initial_delay_seconds = 15
        timeout_seconds       = 5
        period_seconds        = 30
        failure_threshold     = 3
        http_get {
          path = "/healthz"
          port = 8080
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "APP_ENV"
        value = "cloud"
      }
      env {
        name  = "STORAGE_BACKEND"
        value = var.storage_backend
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "BQ_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "BQ_DATASET_ID"
        value = google_bigquery_dataset.analytics.dataset_id
      }
      env {
        name  = "BQ_LOCATION"
        value = local.bq_location
      }
      env {
        name  = "GCS_DATA_BUCKET"
        value = var.create_gcs_bucket ? google_storage_bucket.data_cache[0].name : ""
      }
      env {
        name  = "GCS_DATA_OBJECT"
        value = "store.json.gz"
      }
      env {
        name  = "GOOGLE_GENAI_USE_VERTEXAI"
        value = tostring(var.use_vertex_ai)
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = var.region
      }
      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }
      env {
        name  = "SKILLS_ORGANIZATION_SLUG"
        value = var.skills_organization_slug
      }
      env {
        name  = "SKILLS_CONTRACTED_LICENSES"
        value = tostring(var.skills_contracted_licenses)
      }
      env {
        name  = "LOCK_SETTINGS_IN_CLOUD"
        value = "true"
      }

      # Webhook token para invalidación inmediata de caché desde Cloud Run Job
      env {
        name = "CRON_REFRESH_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.cron_refresh_token.secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = var.has_skills_secrets_versions ? [1] : []
        content {
          name = "SKILLS_ACCESS_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.skills_access_key.secret_id
              version = "latest"
            }
          }
        }
      }

      dynamic "env" {
        for_each = var.has_skills_secrets_versions ? [1] : []
        content {
          name = "SKILLS_SECRET_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.skills_secret_key.secret_id
              version = "latest"
            }
          }
        }
      }

      dynamic "env" {
        for_each = (!var.use_vertex_ai && var.has_gemini_secret_version) ? [1] : []
        content {
          name = "GEMINI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.gemini_api_key.secret_id
              version = "latest"
            }
          }
        }
      }

      dynamic "env" {
        for_each = (var.auth_mode == "basic_auth" && var.has_basic_auth_secret_version) ? [1] : []
        content {
          name = "DASHBOARD_ACCESS_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.dashboard_password.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_version.cron_refresh_token_v1,
    google_secret_manager_secret_iam_member.web_secret_accessor,
    google_bigquery_dataset_iam_member.web_bq_data_editor,
  ]
}

# Permitir acceso HTTP externo únicamente cuando auth_mode es 'basic_auth' o 'public_iap'
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count    = var.auth_mode != "iam_private" ? 1 : 0
  project  = var.project_id
  location = google_cloud_run_v2_service.dashboard.location
  name     = google_cloud_run_v2_service.dashboard.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ============================================================================
# Cloud Run v2 Job + Cloud Scheduler — Sincronización Nocturna Desatendida
# ============================================================================

resource "google_cloud_run_v2_job" "sync_job" {
  name     = "${var.service_name}-sync-job"
  location = var.region
  labels   = local.common_labels

  template {
    task_count = 1
    template {
      service_account = google_service_account.sync_worker.email
      timeout         = "3600s"
      max_retries     = 1

      containers {
        image   = local.resolved_image
        command = ["./node_modules/.bin/tsx"]
        args    = ["scripts/run-sync-job.ts"]

        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        env {
          name  = "APP_ENV"
          value = "cloud"
        }
        env {
          name  = "STORAGE_BACKEND"
          value = var.storage_backend
        }
        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }
        env {
          name  = "GCP_REGION"
          value = var.region
        }
        env {
          name  = "BQ_PROJECT_ID"
          value = var.project_id
        }
        env {
          name  = "BQ_DATASET_ID"
          value = google_bigquery_dataset.analytics.dataset_id
        }
        env {
          name  = "BQ_LOCATION"
          value = local.bq_location
        }
        env {
          name  = "GCS_DATA_BUCKET"
          value = var.create_gcs_bucket ? google_storage_bucket.data_cache[0].name : ""
        }
        env {
          name  = "SKILLS_ORGANIZATION_SLUG"
          value = var.skills_organization_slug
        }
        env {
          name  = "SKILLS_CONTRACTED_LICENSES"
          value = tostring(var.skills_contracted_licenses)
        }
        env {
          name  = "SYNC_LOOKBACK_DAYS"
          value = tostring(var.sync_lookback_days)
        }
        env {
          name  = "CLOUD_RUN_SERVICE_URL"
          value = google_cloud_run_v2_service.dashboard.uri
        }

        env {
          name = "CRON_REFRESH_TOKEN"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.cron_refresh_token.secret_id
              version = "latest"
            }
          }
        }

        dynamic "env" {
          for_each = var.has_skills_secrets_versions ? [1] : []
          content {
            name = "SKILLS_ACCESS_KEY"
            value_source {
              secret_key_ref {
                secret  = google_secret_manager_secret.skills_access_key.secret_id
                version = "latest"
              }
            }
          }
        }

        dynamic "env" {
          for_each = var.has_skills_secrets_versions ? [1] : []
          content {
            name = "SKILLS_SECRET_KEY"
            value_source {
              secret_key_ref {
                secret  = google_secret_manager_secret.skills_secret_key.secret_id
                version = "latest"
              }
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_version.cron_refresh_token_v1,
    google_secret_manager_secret_iam_member.sync_secret_accessor,
    google_bigquery_dataset_iam_member.sync_bq_data_editor,
  ]
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_can_execute" {
  project  = var.project_id
  location = google_cloud_run_v2_job.sync_job.location
  name     = google_cloud_run_v2_job.sync_job.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_invoker.email}"
}

resource "google_cloud_scheduler_job" "nightly_sync" {
  count            = var.enable_scheduled_sync ? 1 : 0
  name             = "${var.service_name}-nightly-sync"
  description      = "Sincronización automática diaria desde Google Skills API v2 hacia BigQuery Data Warehouse."
  schedule         = var.sync_cron_schedule
  time_zone        = var.sync_time_zone
  region           = var.region
  attempt_deadline = "320s"

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.sync_job.name}:run"

    oauth_token {
      service_account_email = google_service_account.scheduler_invoker.email
    }
  }

  depends_on = [
    google_project_service.apis,
    google_cloud_run_v2_job_iam_member.scheduler_can_execute,
  ]
}
