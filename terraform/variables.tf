variable "project_id" {
  description = "ID del proyecto de Google Cloud donde se desplegará SkillsBoost Dashboard y BigQuery."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "El project_id debe ser un identificador válido de GCP (minúsculas, números y guiones, de 6 a 30 caracteres)."
  }
}

variable "region" {
  description = "Región de Google Cloud para Cloud Run, Artifact Registry y Cloud Scheduler."
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Nombre del servicio web en Google Cloud Run."
  type        = string
  default     = "skillsboost-dashboard"
}

variable "artifact_repo_id" {
  description = "Identificador del repositorio Docker en Google Artifact Registry."
  type        = string
  default     = "skillsboost"
}

variable "container_image" {
  description = "URI completa de la imagen contenedor en Artifact Registry. Si se deja vacía, usa la ruta estándar del proyecto."
  type        = string
  default     = ""
}

variable "storage_backend" {
  description = "Motor primario de persistencia de datos en la nube: 'bigquery' (recomendado) o 'gcs'."
  type        = string
  default     = "bigquery"

  validation {
    condition     = contains(["bigquery", "gcs"], var.storage_backend)
    error_message = "storage_backend debe ser 'bigquery' o 'gcs'."
  }
}

variable "bq_dataset_id" {
  description = "Identificador del Dataset de Data Warehouse en Google BigQuery."
  type        = string
  default     = "skillsboost_analytics"

  validation {
    condition     = can(regex("^[a-zA-Z0-9_]+$", var.bq_dataset_id))
    error_message = "bq_dataset_id solo puede contener letras, números y guiones bajos (_)."
  }
}

variable "bq_location" {
  description = "Ubicación geográfica del Dataset de BigQuery. Si está vacío, hereda var.region."
  type        = string
  default     = ""
}

variable "bq_deletion_protection" {
  description = "Protege las tablas de BigQuery contra eliminación accidental en 'terraform destroy'."
  type        = bool
  default     = true
}

variable "create_gcs_bucket" {
  description = "Crea un bucket privado en Cloud Storage para snapshots GZIP de respaldo o modo 'gcs'."
  type        = bool
  default     = true
}

variable "gcs_bucket_name" {
  description = "Nombre opcional del bucket GCS. Si está vacío, usa '<project_id>-skillsboost-data'."
  type        = string
  default     = ""
}

variable "auth_mode" {
  description = "Esquema de control de acceso al Dashboard: 'iam_private' (IAM/Proxy), 'basic_auth' (contraseña en Secret Manager) o 'public_iap' (detrás de IAP/LB)."
  type        = string
  default     = "iam_private"

  validation {
    condition     = contains(["iam_private", "basic_auth", "public_iap"], var.auth_mode)
    error_message = "auth_mode debe ser 'iam_private', 'basic_auth' o 'public_iap'."
  }
}

variable "use_vertex_ai" {
  description = "Si es true, consume Gemini mediante Vertex AI con Service Account (ADC) sin requerir GEMINI_API_KEY."
  type        = bool
  default     = true
}

variable "gemini_model" {
  description = "Modelo Gemini utilizado por los módulos de IA del tablero."
  type        = string
  default     = "gemini-2.5-flash"
}

variable "skills_organization_slug" {
  description = "Slug oficial de la organización en Google Skills for Organizations (ej. 'mi-organizacion')."
  type        = string
  default     = ""
}

variable "skills_contracted_licenses" {
  description = "Cupo anual contratado de licencias para cálculo de adopción y simulador financiero."
  type        = number
  default     = 500
}

variable "has_skills_secrets_versions" {
  description = "Indica si Secret Manager ya cuenta con versiones cargadas para SKILLS_ACCESS_KEY y SKILLS_SECRET_KEY."
  type        = bool
  default     = false
}

variable "has_gemini_secret_version" {
  description = "Indica si Secret Manager cuenta con versión cargada para GEMINI_API_KEY (cuando use_vertex_ai = false)."
  type        = bool
  default     = false
}

variable "has_basic_auth_secret_version" {
  description = "Indica si Secret Manager cuenta con versión cargada para DASHBOARD_ACCESS_PASSWORD (cuando auth_mode = 'basic_auth')."
  type        = bool
  default     = false
}

variable "enable_scheduled_sync" {
  description = "Crea un Cloud Scheduler Job nocturno que dispara el Cloud Run Sync Job automáticamente."
  type        = bool
  default     = true
}

variable "sync_cron_schedule" {
  description = "Expresión cron para sincronización desatendida (por defecto 02:00 AM todos los días)."
  type        = string
  default     = "0 2 * * *"
}

variable "sync_time_zone" {
  description = "Zona horaria IANA para Cloud Scheduler (ej. 'UTC', 'America/New_York')."
  type        = string
  default     = "UTC"
}

variable "sync_lookback_days" {
  description = "Días hacia atrás a consultar en el Job programado (0 = historial completo desde 2020)."
  type        = number
  default     = 0
}

variable "min_instances" {
  description = "Mínimo de instancias activas en Cloud Run (0 para ahorro total en inactividad, 1 para cero cold-start)."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Máximo de réplicas concurrentes del servicio web en Cloud Run."
  type        = number
  default     = 3
}

variable "memory_limit" {
  description = "Memoria RAM asignada por instancia de Cloud Run."
  type        = string
  default     = "1Gi"
}

variable "cpu_limit" {
  description = "vCPUs asignadas por instancia de Cloud Run."
  type        = string
  default     = "1"
}

variable "labels" {
  description = "Etiquetas adicionales de atribución de costos y gobierno Cloud."
  type        = map(string)
  default     = {}
}
