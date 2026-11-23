#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Despliegue Automatizado a Google Cloud Run + GCS + Secret Manager
# Tablero Ejecutivo: Google Skills for Organizations
# ==============================================================================

# Cargar variables locales desde .env si existe (para hidratar Secret Manager)
if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-skillsboost-dashboard}"
GCS_BUCKET="${GCS_DATA_BUCKET:-${PROJECT_ID}-skillsboost-data}"
GCS_OBJECT="${GCS_DATA_OBJECT:-store.json.gz}"
SA_NAME="skillsboost-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
ALLOW_PUBLIC="${ALLOW_UNAUTHENTICATED:-false}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "❌ Error: Define GCP_PROJECT_ID en tu archivo .env o ejecuta 'gcloud config set project TU_PROYECTO'."
  exit 1
fi

echo "=================================================================="
echo "🚀 Preparando despliegue en Google Cloud"
echo "   • Proyecto GCP:    ${PROJECT_ID}"
echo "   • Región:          ${REGION}"
echo "   • Servicio:        ${SERVICE_NAME}"
echo "   • Bucket GCS:      gs://${GCS_BUCKET}/${GCS_OBJECT}"
echo "   • Acceso Público:  ${ALLOW_PUBLIC} (Usa ALLOW_UNAUTHENTICATED=true para abrir con contraseña)"
echo "=================================================================="

# 1. Habilitar APIs necesarias
echo "1️⃣  Habilitando APIs de Google Cloud..."
gcloud services enable \
  run.googleapis.com \
  bigquery.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  --project="${PROJECT_ID}"

# 2. Crear Service Account dedicada con privilegios mínimos
echo "2️⃣  Verificando Service Account dedicada (${SA_EMAIL})..."
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="SkillsBoost Dashboard Cloud Run Runtime" \
    --project="${PROJECT_ID}"
fi

for ROLE in "roles/bigquery.jobUser" "roles/bigquery.dataEditor" "roles/aiplatform.user"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}" \
    --quiet >/dev/null
done

# 3. Crear Bucket privado en Google Cloud Storage para persistencia comprimida
echo "3️⃣  Verificando Bucket privado gs://${GCS_BUCKET}..."
if ! gcloud storage buckets describe "gs://${GCS_BUCKET}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${GCS_BUCKET}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access \
    --public-access-prevention
fi

gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" >/dev/null

# 4. Registrar credenciales en Google Secret Manager
upsert_secret() {
  local secret_name="$1"
  local secret_val="$2"
  if [[ -z "${secret_val}" ]]; then
    return 0
  fi
  if ! gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud secrets create "${secret_name}" \
      --replication-policy="automatic" \
      --project="${PROJECT_ID}" >/dev/null
  fi
  printf "%s" "${secret_val}" | gcloud secrets versions add "${secret_name}" \
    --data-file=- \
    --project="${PROJECT_ID}" >/dev/null
  gcloud secrets add-iam-policy-binding "${secret_name}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="${PROJECT_ID}" >/dev/null
}

echo "4️⃣  Sincronizando claves en Google Secret Manager..."
SECRET_FLAGS=()

if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  upsert_secret "skillsboost-gemini-api-key" "${GEMINI_API_KEY}"
  SECRET_FLAGS+=("GEMINI_API_KEY=skillsboost-gemini-api-key:latest")
fi
if [[ -n "${SKILLS_ACCESS_KEY:-}" ]]; then
  upsert_secret "skillsboost-access-key" "${SKILLS_ACCESS_KEY}"
  SECRET_FLAGS+=("SKILLS_ACCESS_KEY=skillsboost-access-key:latest")
fi
if [[ -n "${SKILLS_SECRET_KEY:-}" ]]; then
  upsert_secret "skillsboost-secret-key" "${SKILLS_SECRET_KEY}"
  SECRET_FLAGS+=("SKILLS_SECRET_KEY=skillsboost-secret-key:latest")
fi
if [[ -n "${DASHBOARD_ACCESS_PASSWORD:-}" ]]; then
  upsert_secret "skillsboost-access-password" "${DASHBOARD_ACCESS_PASSWORD}"
  SECRET_FLAGS+=("DASHBOARD_ACCESS_PASSWORD=skillsboost-access-password:latest")
fi

# 5. Subir snapshot inicial de datos locales (.data/store.json -> BigQuery y/o GCS)
CLOUD_BACKEND="${CLOUD_STORAGE_BACKEND:-bigquery}"
BQ_DATASET="${BQ_DATASET_ID:-skillsboost_analytics}"

if [[ -f ".data/store.json" ]]; then
  if [[ "${CLOUD_BACKEND}" == "bigquery" ]]; then
    echo "5️⃣  Migrando base de datos local hacia BigQuery (${PROJECT_ID}.${BQ_DATASET})..."
    GCP_PROJECT_ID="${PROJECT_ID}" BQ_PROJECT_ID="${PROJECT_ID}" BQ_DATASET_ID="${BQ_DATASET}" BQ_LOCATION="${REGION}" npm run data:push-bq
  fi
  echo "5️⃣  Subiendo respaldo comprimido a gs://${GCS_BUCKET}/${GCS_OBJECT}..."
  GCS_DATA_BUCKET="${GCS_BUCKET}" GCS_DATA_OBJECT="${GCS_OBJECT}" npm run data:push
else
  echo "5️⃣  No existe .data/store.json local; Cloud Run inicializará el almacén automáticamente."
fi

# 6. Construir imagen y desplegar en Cloud Run
echo "6️⃣  Desplegando contenedor en Google Cloud Run..."
AUTH_FLAG="--no-allow-unauthenticated"
if [[ "${ALLOW_PUBLIC}" == "true" ]]; then
  AUTH_FLAG="--allow-unauthenticated"
fi

USE_VERTEX="${GOOGLE_GENAI_USE_VERTEXAI:-true}"
if [[ -n "${GEMINI_API_KEY:-}" && -z "${GOOGLE_GENAI_USE_VERTEXAI:-}" ]]; then
  USE_VERTEX="false"
fi

ENV_VARS="NODE_ENV=production,APP_ENV=cloud,STORAGE_BACKEND=${CLOUD_BACKEND},GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION}"
ENV_VARS="${ENV_VARS},BQ_PROJECT_ID=${PROJECT_ID},BQ_DATASET_ID=${BQ_DATASET},BQ_LOCATION=${REGION}"
ENV_VARS="${ENV_VARS},GCS_DATA_BUCKET=${GCS_BUCKET},GCS_DATA_OBJECT=${GCS_OBJECT},LOCK_SETTINGS_IN_CLOUD=true"
ENV_VARS="${ENV_VARS},GOOGLE_GENAI_USE_VERTEXAI=${USE_VERTEX},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION}"
ENV_VARS="${ENV_VARS},GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.5-flash}"
ENV_VARS="${ENV_VARS},SKILLS_ORGANIZATION_SLUG=${SKILLS_ORGANIZATION_SLUG:-}"
ENV_VARS="${ENV_VARS},SKILLS_CONTRACTED_LICENSES=${SKILLS_CONTRACTED_LICENSES:-500}"

SECRETS_ARG=""
if [[ ${#SECRET_FLAGS[@]} -gt 0 ]]; then
  IFS=',' eval 'SECRETS_JOINED="${SECRET_FLAGS[*]}"'
  SECRETS_ARG="--set-secrets=${SECRETS_JOINED}"
fi

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --service-account="${SA_EMAIL}" \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --concurrency=80 \
  --timeout=900 \
  --no-cpu-throttling \
  "${AUTH_FLAG}" \
  --set-env-vars="${ENV_VARS}" \
  ${SECRETS_ARG}

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')"
echo ""
echo "✅ ¡Despliegue completado con éxito!"
echo "🌐 URL de Cloud Run: ${SERVICE_URL}"
if [[ "${ALLOW_PUBLIC}" != "true" ]]; then
  echo "🔒 Servicio privado protegido por IAM. Para abrirlo localmente autenticado ejecuta:"
  echo "   gcloud run services proxy ${SERVICE_NAME} --project=${PROJECT_ID} --region=${REGION} --port=8080"
fi
