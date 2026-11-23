# Manual 04: Despliegue con Terraform Interactivo e Infraestructura como Código (IaC)

Este manual explica cómo aprovisionar desde cero (o actualizar de manera reproducible) toda la infraestructura de **SkillsBoost Dashboard** en Google Cloud utilizando el **Asistente Interactivo (`npm run deploy:wizard`)** o ejecutando directamente los módulos declarativos en `/terraform`.

---

## 1. Recursos Aprovisionados por Terraform

La configuración ubicada en la carpeta `terraform/` crea y gobierna de extremo a extremo:

1. **APIs de Google Cloud (`main.tf`)**: Habilita `run`, `bigquery`, `cloudscheduler`, `secretmanager`, `artifactregistry`, `cloudbuild`, `storage`, `aiplatform` e `iam`.
2. **Identidades de Privilegio Mínimo (`iam_secrets.tf`)**:
   - `skillsboost-web-sa`: Cuenta de servicio exclusiva del portal web en Cloud Run (`bigquery.jobUser`, `bigquery.dataEditor` sobre el dataset, `aiplatform.user` y lectura acotada de secretos).
   - `skillsboost-sync-sa`: Cuenta de servicio exclusiva del Cloud Run Job de sincronización.
   - `skillsboost-sched-sa`: Cuenta de servicio exclusiva para que Cloud Scheduler dispare el Job (`roles/run.invoker`).
3. **Bóveda de Secretos (`iam_secrets.tf`)**: Contenedores cifrados en **Secret Manager** (`skillsboost-access-key`, `skillsboost-secret-key`, `skillsboost-gemini-api-key`, `skillsboost-access-password` y token interno autogenerado `skillsboost-cron-refresh-token`).
4. **Data Warehouse en BigQuery (`bigquery.tf`)**: Dataset `skillsboost_analytics`, las **8 tablas** con particionamiento mensual y clustering, y las **4 vistas SQL** listas para Looker Studio.
5. **Registro de Contenedores y Respaldo (`cloud_run.tf`)**: Repositorio Docker en **Artifact Registry**, bucket privado opcional en **Cloud Storage** con versionado automático y prevención de acceso público.
6. **Cómputo Serverless y Automatización (`cloud_run.tf`)**:
   - **Cloud Run v2 Service** con sondas `/healthz` (`startup_probe` y `liveness_probe`).
   - **Cloud Run v2 Job** (`skillsboost-dashboard-sync-job`) + **Cloud Scheduler** nocturno.

---

## 2. Prerrequisitos antes de Iniciar

Asegúrate de contar en tu estación de trabajo o Cloud Shell con:
- **Node.js `>= 20`** y `npm` instalados.
- **Google Cloud SDK (`gcloud`)** instalado.
- **Terraform `>= 1.5`** instalado (`terraform version`).
- Un usuario o Service Account de despliegue con permisos de **Editor/Owner** (o los roles específicos `roles/serviceusage.serviceUsageAdmin`, `roles/iam.serviceAccountAdmin`, `roles/resourcemanager.projectIamAdmin`, `roles/run.admin`, `roles/bigquery.admin`, `roles/secretmanager.admin`, `roles/artifactregistry.admin`, `roles/cloudbuild.builds.editor` y `roles/cloudscheduler.admin`).

Autentica tu sesión local antes de correr el asistente:

```bash
gcloud auth login
gcloud auth application-default login
```

---

## 3. Opción A (Recomendada): Despliegue Guiado con el Asistente Interactivo

El asistente `scripts/deploy-interactive.ts` resuelve automáticamente el orden exacto de dependencias en proyectos nuevos (APIs -> Artifact Registry -> Secretos fuera de Git -> Cloud Build -> Terraform Apply -> Migración de datos):

```bash
npm run deploy:wizard
```

### ¿Qué hace el Asistente en cada uno de los 6 Pasos?
1. **Paso 1 — Pre-flight Check**: Verifica binarios `gcloud`, `terraform` y credenciales ADC activas.
2. **Paso 2 — Proyecto y Región**: Detecta tu proyecto actual en `gcloud`, valida su formato y te permite elegir región (`us-central1` recomendada) y nombre del servicio.
3. **Paso 3 — Arquitectura de Datos**: Configura `bigquery` como almacén primario, nombre del dataset (`skillsboost_analytics`), protección contra borrado accidental y bucket GCS de respaldo.
4. **Paso 4 — Motor Gemini y Seguridad**: Permite elegir **Vertex AI con ADC** (sin llaves estáticas) o API Key, y el modo de acceso al tablero (`iam_private`, `basic_auth` o `public_iap`).
5. **Paso 5 — Validación en Vivo de Google Skills API v2**: Solicita tu `organization_slug` y tus llaves `AK_...` / `SK_...`, y **prueba la autenticación en vivo** antes de iniciar el despliegue para evitar errores posteriores.
6. **Paso 6 — Aprovisionamiento Orquestado**:
   - Genera `terraform/terraform.tfvars` (excluido automáticamente de Git en `.gitignore`).
   - Inicializa Terraform y crea los contenedores de Artifact Registry y Secret Manager.
   - Carga los valores sensibles directamente en **Google Secret Manager** por `stdin` (sin escribirlos nunca en texto plano dentro de `terraform.tfvars` ni en el historial de comandos).
   - Construye y publica la imagen Docker mediante **Google Cloud Build** (no necesitas tener Docker instalado localmente).
   - Ejecuta `terraform plan`, te muestra los cambios y solicita confirmación explícita antes de `terraform apply`.
   - Ofrece migrar en un clic tu base local `.data/store.json` hacia BigQuery (`npm run data:push-bq`) o lanzar el primer Job de sincronización.

### Modo Simulación (`--dry-run`)
Si deseas verificar prerrequisitos y previsualizar el `terraform.tfvars` sin tocar ningún recurso en GCP:

```bash
npm run deploy:wizard -- --dry-run
```

---

## 4. Opción B: Uso Manual con Terraform CLI o Pipelines CI/CD

Si administras infraestructura mediante GitOps (Cloud Build Triggers, GitHub Actions o GitLab CI):

```bash
# 1. Copiar plantilla de variables y ajustar valores del proyecto
cp terraform/terraform.tfvars.example terraform/terraform.tfvars

# 2. Inicializar proveedores y validar sintaxis HCL
terraform -chdir=terraform init
terraform -chdir=terraform validate

# 3. Construir y publicar la imagen contenedor en Artifact Registry
gcloud builds submit --tag "us-central1-docker.pkg.dev/TU_PROYECTO/skillsboost/skillsboost-dashboard:latest" .

# 4. Revisar plan de ejecución y aplicar cambios
terraform -chdir=terraform plan -out=tfplan
terraform -chdir=terraform apply tfplan
```

### Configurar Estado Remoto en Cloud Storage (Recomendado en Equipos DevOps)
Para compartir el estado `terraform.tfstate` con bloqueo concurrente en equipo, crea un archivo `terraform/backend.tf`:

```hcl
terraform {
  backend "gcs" {
    bucket = "tu-bucket-corporativo-tfstate"
    prefix = "skillsboost-dashboard/prod"
  }
}
```
Y ejecuta `terraform -chdir=terraform init -migrate-state`.

---

## 5. Referencia Rápida de Variables Principales (`terraform/variables.tf`)

| Variable | Por Defecto | Descripción |
| :--- | :--- | :--- |
| `project_id` | *(Requerido)* | ID del proyecto GCP destino. |
| `region` | `"us-central1"` | Región para Cloud Run, Artifact Registry y Scheduler. |
| `storage_backend` | `"bigquery"` | `"bigquery"` (Data Warehouse + vistas) o `"gcs"`. |
| `bq_dataset_id` | `"skillsboost_analytics"` | Nombre del Dataset en BigQuery. |
| `bq_deletion_protection` | `true` | Impide que un `terraform destroy` borre tablas históricas por accidente. |
| `auth_mode` | `"iam_private"` | `"iam_private"`, `"basic_auth"` o `"public_iap"`. |
| `use_vertex_ai` | `true` | Consume Gemini en Vertex AI vía Service Account sin API Keys. |
| `enable_scheduled_sync` | `true` | Activa el cron diario en Cloud Scheduler hacia el Cloud Run Job. |
| `sync_cron_schedule` | `"0 2 * * *"` | Expresión cron de sincronización nocturna. |
| `min_instances` / `max_instances` | `0` / `3` | Rango de autoescalado del portal web en Cloud Run. |

---

## 6. Actualización de Versiones y Destrucción Segura de Ambientes Demo

### Desplegar una Nueva Versión del Código
Cuando modifiques componentes React o rutas del servidor:

```bash
# Compilar nueva imagen y actualizar revisión en Cloud Run
gcloud builds submit --tag "us-central1-docker.pkg.dev/TU_PROYECTO/skillsboost/skillsboost-dashboard:v1.2" .
terraform -chdir=terraform apply -var="container_image=us-central1-docker.pkg.dev/TU_PROYECTO/skillsboost/skillsboost-dashboard:v1.2"
```

### Eliminar un Entorno Temporal de Pruebas
Por seguridad, `bq_deletion_protection` está activado en `true` para proteger el historial de capacitación. Si deseas destruir por completo un ambiente efímero de laboratorio (previa autorización explícita del propietario de los datos):
1. Cambia `bq_deletion_protection = false` en `terraform/terraform.tfvars` y ejecuta `terraform -chdir=terraform apply`.
2. Ejecuta `terraform -chdir=terraform destroy`.
