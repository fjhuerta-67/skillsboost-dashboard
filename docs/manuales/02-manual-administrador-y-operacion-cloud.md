# Manual 02: Administración Técnica, Seguridad y Operación en Cloud Run

Este manual está dirigido a administradores de plataforma, equipos de **DevOps / SRE**, **Seguridad Cloud** y administradores técnicos del portal **Google Skills for Organizations**.

---

## 1. Obtención y Rotación de Credenciales de Google Skills API v2

Para conectar el tablero con datos reales en vivo necesitas tres parámetros emitidos desde el portal administrativo de Google Skills:

1. Ingresa como **Administrador de Organización** a `https://www.skills.google`.
2. Dirígete a la sección **Organization Admin -> Settings -> API Credentials**.
3. Copia el **Slug de tu Organización** directamente de la barra de direcciones del navegador:
   - Ejemplo: en `https://www.skills.google/organization/grupo-ejemplo/settings`, tu slug es `grupo-ejemplo`.
4. Genera un par de llaves de reporte v2:
   - **`SKILLS_ACCESS_KEY`** (prefijo habitual `AK_...`)
   - **`SKILLS_SECRET_KEY`** (prefijo habitual `SK_...`)

### Procedimiento de Rotación Segura en Producción (Zero-Downtime)
Cuando debas rotar las llaves por política trimestral/anual de seguridad:

```bash
# 1. Cargar nuevas versiones en Google Secret Manager (sin tocar archivos locales)
printf "%s" "NUEVA_ACCESS_KEY" | gcloud secrets versions add skillsboost-access-key --data-file=- --project="TU_PROYECTO"
printf "%s" "NUEVA_SECRET_KEY" | gcloud secrets versions add skillsboost-secret-key --data-file=- --project="TU_PROYECTO"

# 2. Actualizar revisión de Cloud Run para tomar la versión :latest inmediatamente
gcloud run services update skillsboost-dashboard \
  --region="us-central1" \
  --project="TU_PROYECTO" \
  --update-env-vars="LAST_SECRET_ROTATION=$(date -u +%Y%m%dT%H%M%SZ)"
```

---

## 2. Arquitectura de Ejecución y Variables de Entorno

La aplicación soporta **3 motores de persistencia** seleccionables mediante `STORAGE_BACKEND`:

| Modo (`STORAGE_BACKEND`) | Cuándo utilizarlo | Fuente de Verdad |
| :--- | :--- | :--- |
| **`local`** | Desarrollo en estación de trabajo o pruebas rápidas sin nube. | Archivo JSON local en `.data/store.json`. |
| **`gcs`** | Despliegues ligeros de una sola instancia sin requerimientos de BI externo. | Objeto comprimido GZIP `gs://<BUCKET>/store.json.gz` (sin secretos). |
| **`bigquery`** *(Recomendado)* | Producción empresarial multi-instancia, auditoría histórica y conexión con Looker Studio. | Dataset `skillsboost_analytics` en BigQuery + caché rápida en RAM con TTL. |

### Tabla de Variables de Entorno Principales

| Variable | Valor Recomendado en Cloud Run | Descripción |
| :--- | :--- | :--- |
| `APP_ENV` | `cloud` | Activa comportamiento de producción en la nube. |
| `STORAGE_BACKEND` | `bigquery` | Define BigQuery como almacén maestro de datos. |
| `GCP_PROJECT_ID` / `BQ_PROJECT_ID` | ID del proyecto GCP | Proyecto donde residen Cloud Run y BigQuery. |
| `BQ_DATASET_ID` | `skillsboost_analytics` | Dataset de BigQuery donde se alojan tablas y vistas. |
| `BQ_LOCATION` | `us-central1` | Región del Dataset de BigQuery. |
| `BQ_CACHE_TTL_MS` | `300000` (5 min) | Frecuencia con que cada instancia verifica si hay nuevas corridas en `sync_audit_log`. |
| `GOOGLE_GENAI_USE_VERTEXAI` | `true` | Usa Vertex AI mediante la Service Account del contenedor (sin `GEMINI_API_KEY`). |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo primario utilizado en consultas y generación de planes/reportes. |
| `SKILLS_ORGANIZATION_SLUG` | Slug corporativo | Identificador de la organización en Google Skills. |
| `SKILLS_CONTRACTED_LICENSES` | Ej. `500` | Tope anual de asientos contratados para cálculo de ROI y adopción. |
| `LOCK_SETTINGS_IN_CLOUD` | `true` | Oculta y bloquea la edición de llaves API desde la interfaz web. |
| `DASHBOARD_ACCESS_PASSWORD` | *(Secret Manager opcional)* | Si se define, protege todas las rutas web con HTTP Basic Auth seguro (`timingSafeEqual`). |

---

## 3. Esquemas de Seguridad y Control de Acceso en Cloud Run

Puedes operar el portal bajo tres modelos de seguridad según la arquitectura de red de tu organización:

### Modelo A: Privado con Google Cloud IAM (`auth_mode = "iam_private"` — Predeterminado)
El servicio en Cloud Run bloquea cualquier tráfico no autenticado (`--no-allow-unauthenticated`). Los usuarios autorizados con el rol `roles/run.invoker` acceden mediante el túnel autenticado oficial de `gcloud`:

```bash
gcloud run services proxy skillsboost-dashboard \
  --project="TU_PROYECTO" \
  --region="us-central1" \
  --port=8080
```
Luego abren `http://localhost:8080` autenticado con su identidad corporativa de Google Cloud.

### Modelo B: Identity-Aware Proxy — Cloud IAP (`auth_mode = "public_iap"`)
Ideal para acceso directo desde navegador con Single Sign-On (SSO) de Google Workspace para directivos sin usar consola CLI:
1. Coloca un **Global External Application Load Balancer** con certificado gestionado frente al Serverless NEG de Cloud Run.
2. Activa **Identity-Aware Proxy (IAP)** sobre el Backend Service y otorga el rol `IAP-secured Web App User` al grupo de Google Workspace de directivos y RH (ej. `lideres-capacitacion@tuempresa.com`).
3. Restringe el ingreso de Cloud Run a `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`.

### Modelo C: Acceso Rápido Protegido por Contraseña (`auth_mode = "basic_auth"`)
Útil para demos ejecutivas inmediatas sin configurar un Load Balancer global:
- Cloud Run expone HTTPS público, pero Express exige autenticación HTTP Basic respaldada por el secreto `skillsboost-access-password` en Secret Manager antes de entregar cualquier ruta o recurso estático (excepto `/healthz` para monitoreo de plataforma).

---

## 4. Operación de Sincronización Desatendida (Cloud Run Jobs + Cloud Scheduler)

En organizaciones grandes (1,000 a 10,000+ licencias), la compilación asíncrona del reporte histórico en Google Skills API v2 (`/reports/learning_activities` -> `/operations/{id}`) suele demorar entre **5 y 25 minutos**.

Para garantizar confiabilidad total:
1. **Cloud Scheduler (`skillsboost-dashboard-nightly-sync`)** dispara todos los días a las **02:00 AM** (`UTC` o la zona horaria IANA configurada) una ejecución autenticada con OAuth2 OIDC sobre el **Cloud Run Job (`skillsboost-dashboard-sync-job`)**.
2. El Job ejecuta `scripts/run-sync-job.ts` con hasta **60 minutos de margen**, actualiza `dim_catalog`, `dim_teams`, `dim_members`, ejecuta un **`MERGE` idempotente** sobre `fact_learning_activities`, agrega una instantánea diaria en `fact_org_stats_snapshots` y registra la corrida en `sync_audit_log`.
3. Al finalizar, el Job invoca `POST /api/cron/refresh-cache` autenticado con `X-Cron-Token` para refrescar la memoria del servicio web al instante.

### Comandos Útiles de Operación del Sync Job

```bash
# Disparar una sincronización inmediata desde terminal y esperar su finalización
gcloud run jobs execute skillsboost-dashboard-sync-job \
  --project="TU_PROYECTO" \
  --region="us-central1" \
  --wait

# Consultar el historial de ejecuciones recientes del Job
gcloud run jobs executions list \
  --job="skillsboost-dashboard-sync-job" \
  --project="TU_PROYECTO" \
  --region="us-central1"

# Configurar sincronizaciones diarias incrementales rápidas (ej. últimos 30 días)
gcloud run jobs update skillsboost-dashboard-sync-job \
  --project="TU_PROYECTO" \
  --region="us-central1" \
  --update-env-vars="SYNC_LOOKBACK_DAYS=30"
```
*(Nota: Gracias al `MERGE` por llave determinística `activity_key` en BigQuery, activar `SYNC_LOOKBACK_DAYS=30` conserva intactos todos los registros históricos de años anteriores mientras reduce el tiempo diario de extracción).*

---

## 5. Monitoreo, Salud (`/healthz`) y Resolución de Incidentes

### Verificación de Salud del Servicio
El endpoint `/healthz` responde `HTTP 200` sin requerir sesión de usuario para las sondas `startup_probe` y `liveness_probe`:

```json
{
  "ok": true,
  "runtimeEnv": "cloud",
  "storageBackend": "bigquery",
  "gcsBucket": "mi-proyecto-skillsboost-data",
  "bqDataset": "mi-proyecto.skillsboost_analytics",
  "geminiAuthMode": "vertex_ai",
  "activities": 48250
}
```

### Guía Rápida de Troubleshooting

| Síntoma Observado | Causa Probable | Solución |
| :--- | :--- | :--- |
| El tablero inicia en **Modo: Datos Demo** en Cloud Run. | Faltan versiones cargadas en `skillsboost-access-key` / `skillsboost-secret-key` o aún no se ha corrido la primera sincronización. | Verifica secretos en Secret Manager y ejecuta `gcloud run jobs execute skillsboost-dashboard-sync-job` o presiona **Sincronizar**. |
| Error `401 Fallo de autenticación` al probar conexión con Google Skills. | `SKILLS_ACCESS_KEY` o `SKILLS_SECRET_KEY` expiradas o copiadas con espacios extra. | Genera nuevas llaves en Google Skills Admin Portal y actualízalas en Secret Manager (Sección 1). |
| Autenticación exitosa pero error `404` en catálogo de Google Skills. | `SKILLS_ORGANIZATION_SLUG` incorrecto. | Verifica el segmento exacto después de `/organization/` en la URL administrativa de Google Skills. |
| Error `Permission denied` en consultas o cargas de BigQuery. | La cuenta de servicio carece de `roles/bigquery.jobUser` en el proyecto o `roles/bigquery.dataEditor` en el dataset. | Ejecuta `terraform apply` en `/terraform` para restaurar las políticas IAM declarativas. |
| Los módulos de IA devuelven error de configuración Gemini. | Ni Vertex AI API (`aiplatform.googleapis.com`) está habilitada ni existe `GEMINI_API_KEY`. | Habilita `aiplatform.googleapis.com` y confirma `GOOGLE_GENAI_USE_VERTEXAI=true` con rol `roles/aiplatform.user` en `skillsboost-web-sa`. |
