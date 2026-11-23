output "dashboard_url" {
  description = "URL HTTPS del servicio web desplegado en Google Cloud Run."
  value       = google_cloud_run_v2_service.dashboard.uri
}

output "cloud_run_proxy_command" {
  description = "Comando para acceder de forma segura cuando auth_mode = 'iam_private'."
  value       = "gcloud run services proxy ${google_cloud_run_v2_service.dashboard.name} --project=${var.project_id} --region=${var.region} --port=8080"
}

output "bigquery_dataset" {
  description = "Ruta calificada del Dataset analítico en Google BigQuery."
  value       = "${var.project_id}.${google_bigquery_dataset.analytics.dataset_id}"
}

output "bigquery_views" {
  description = "Vistas SQL optimizadas listas para conectar en Looker Studio o Connected Sheets."
  value = [
    "${var.project_id}.${google_bigquery_dataset.analytics.dataset_id}.vw_executive_kpis",
    "${var.project_id}.${google_bigquery_dataset.analytics.dataset_id}.vw_license_adoption_roi",
    "${var.project_id}.${google_bigquery_dataset.analytics.dataset_id}.vw_team_skill_matrix",
    "${var.project_id}.${google_bigquery_dataset.analytics.dataset_id}.vw_certification_candidates",
  ]
}

output "sync_job_trigger_command" {
  description = "Comando para disparar una ejecución inmediata del Cloud Run Job de sincronización."
  value       = "gcloud run jobs execute ${google_cloud_run_v2_job.sync_job.name} --project=${var.project_id} --region=${var.region} --wait"
}

output "artifact_registry_repository" {
  description = "Ruta del repositorio Docker en Artifact Registry."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
}

output "gcs_cache_bucket" {
  description = "Nombre del bucket privado en Cloud Storage (si create_gcs_bucket = true)."
  value       = var.create_gcs_bucket ? google_storage_bucket.data_cache[0].name : null
}
