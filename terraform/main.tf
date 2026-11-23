provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  bq_location     = var.bq_location != "" ? var.bq_location : var.region
  gcs_bucket_name = var.gcs_bucket_name != "" ? var.gcs_bucket_name : "${var.project_id}-skillsboost-data"
  resolved_image = (
    var.container_image != ""
    ? var.container_image
    : "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repo_id}/${var.service_name}:latest"
  )

  common_labels = merge(
    {
      app        = "skillsboost-dashboard"
      managed_by = "terraform"
      component  = "lxp-analytics"
    },
    var.labels
  )

  required_apis = toset([
    "run.googleapis.com",
    "bigquery.googleapis.com",
    "cloudscheduler.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "storage.googleapis.com",
    "aiplatform.googleapis.com",
    "iam.googleapis.com",
  ])
}

resource "google_project_service" "apis" {
  for_each           = local.required_apis
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
