# Manual 03: Diccionario de Datos en BigQuery y Guía de Conexión con Looker Studio

Este manual documenta la arquitectura del **Data Warehouse Analítico en Google BigQuery** (`skillsboost_analytics`), el diccionario detallado de sus **8 tablas** y **4 vistas de inteligencia de negocios (BI)**, así como los pasos para conectar **Looker Studio** y **Google Sheets (Connected Sheets)**.

---

## 1. Diseño del Almacén de Datos y Optimizaciones de Costo/Rendimiento

El adaptador nativo (`src/lib/bigquery-adapter.ts`) y el módulo de Terraform (`terraform/bigquery.tf`) aplican buenas prácticas empresariales de ingeniería de datos en BigQuery:

1. **Particionamiento Mensual (`MONTH`)**:
   - `fact_learning_activities` se particiona por `activity_date` a nivel mensual (`MONTH`), soportando décadas de historial desde 2020 sin acercarse jamás al límite de 4,000 particiones diarias de BigQuery y reduciendo drásticamente los bytes escaneados por filtro de fechas.
2. **Clustering Multi-Columna**:
   - `fact_learning_activities` está clusterizada por `['team_slug', 'category', 'activity_type', 'member_email']`, acelerando filtros por gerencia, dominio tecnológico y tipo de actividad.
3. **Ingesta Gratuita sin Bloqueos de Streaming Buffer**:
   - Las sincronizaciones utilizan **BigQuery Load Jobs (`NEWLINE_DELIMITED_JSON`)**, que no generan cargos de *streaming insert* y dejan las filas inmediatamente disponibles para sentencias DML (`MERGE`, `UPDATE`, `DELETE`).
4. **Deduplicación Determinística (`MERGE` por `activity_key`)**:
   - Cada actividad recibe una llave SHA-256 calculada sobre `lower(member_email) | content_id | started_at | activity_type`. Si una actividad cambia de *En Curso* a *Aprobada (`passed = true`)* en una corrida posterior, el `MERGE` actualiza el registro existente sin duplicar filas.

---

## 2. Diccionario de Tablas Base (`skillsboost_analytics`)

### 2.1 `fact_learning_activities` (Tabla de Hechos Principal)
*Particionamiento:* `MONTH(activity_date)` • *Clustering:* `team_slug, category, activity_type, member_email`

| Columna | Tipo | Modo | Descripción |
| :--- | :--- | :--- | :--- |
| `activity_key` | `STRING` | `REQUIRED` | Hash determinístico único para deduplicación incremental (`MERGE`). |
| `activity_id` | `STRING` | `NULLABLE` | Identificador interno de referencia en la aplicación. |
| `member_email` | `STRING` | `REQUIRED` | Correo electrónico corporativo del estudiante en minúsculas. |
| `member_name` | `STRING` | `NULLABLE` | Nombre completo resuelto desde el padrón de equipos o correo. |
| `team_slug` | `STRING` | `NULLABLE` | Slug del equipo asignado (o `organizacion-general` si no tiene sub-equipo). |
| `team_name` | `STRING` | `NULLABLE` | Nombre legible del equipo o gerencia. |
| `content_id` | `STRING` | `NULLABLE` | Identificador único del curso, laboratorio o ruta en Google Skills. |
| `activity_name` | `STRING` | `NULLABLE` | Título oficial de la actividad de aprendizaje. |
| `activity_type` | `STRING` | `NULLABLE` | Tipo: `Lab`, `Course`, `Path`, `Exam`, `Game` o `Certification`. |
| `category` | `STRING` | `NULLABLE` | Dominio técnico clasificado (ej. `AI & Machine Learning`, `Data & Analytics`). |
| `passed` | `BOOL` | `NULLABLE` | `TRUE` únicamente cuando la actividad fue acreditada/aprobada oficialmente. |
| `given_score` | `FLOAT64` | `NULLABLE` | Calificación numérica obtenida por el colaborador. |
| `maximum_score` | `FLOAT64` | `NULLABLE` | Puntaje máximo posible de la evaluación o laboratorio. |
| `learning_time_minutes` | `FLOAT64` | `NULLABLE` | Minutos efectivos invertidos en la actividad. |
| `started_at` | `TIMESTAMP` | `NULLABLE` | Fecha y hora UTC de inicio de la actividad. |
| `completed_at` | `TIMESTAMP` | `NULLABLE` | Fecha y hora UTC de finalización o cierre de intento. |
| `activity_date` | `DATE` | `NULLABLE` | Fecha base (`COALESCE(completed_at, started_at)`) para particionamiento. |
| `content_url` | `STRING` | `NULLABLE` | Enlace directo al contenido dentro de Google Skills. |
| `parent_type` / `parent_name` | `STRING` | `NULLABLE` | Tipo y nombre de la Ruta o Certificación padre cuando aplica. |
| `synced_at` | `TIMESTAMP` | `REQUIRED` | Marca de tiempo UTC de la última actualización en BigQuery. |

### 2.2 Tablas Dimensionales, Serie Histórica y Estado Operativo

| Tabla | Propósito | Columnas Clave |
| :--- | :--- | :--- |
| **`dim_catalog`** | Catálogo completo de Google Skills. | `content_id`, `content_type`, `name`, `category`, `level`, `duration_minutes`, `available_locales` (`REPEATED`), `url`. |
| **`dim_teams`** | Catálogo de equipos configurados en la organización. | `slug`, `name`, `description`, `active`, `member_count`, `synced_at`. |
| **`dim_members`** | Padrón de integrantes por equipo e invitación. | `email`, `first_name`, `last_name`, `status` (`active`/`pending`/`revoked`), `team_slug`, `team_name`. |
| **`fact_org_stats_snapshots`** | Serie histórica diaria del endpoint oficial `/stats` para medir tendencias de licencias y Skill Badges en el tiempo. | `snapshot_date`, `contracted_licenses`, `accepted_invitations`, `pending_invitations`, `cumulative_learners`, `skills_badges_earned`. |
| **`app_goals_okrs`** | Metas trimestrales configuradas por Dirección/L&D. | `id`, `team_slug`, `title`, `target_hours_per_member`, `target_adoption_rate`, `target_category`, `quarter_label`. |
| **`app_ai_curricula`** | Planes curriculares semanales creados con Gemini IA. | `id`, `target_role`, `team_slug`, `weeks_count`, `hours_per_week`, `generated_by_model`, `payload_json`. |
| **`sync_audit_log`** | Bitácora de corridas de sincronización y control de caché. | `sync_id`, `sync_date`, `synced_at`, `mode`, `status`, `activities_count`, `contracted_licenses`. |

---

## 3. Vistas Analíticas Preconstruidas para BI

Al desplegar con Terraform (o ejecutar `npm run data:init-bq`), quedan listas **4 vistas SQL optimizadas** (también disponibles en `bigquery/sql-views.sql`):

1. **`vw_executive_kpis`**: Resumen mensual agregado con actividades iniciadas, completadas (`passed = TRUE`), laboratorios aprobados, cursos terminados, alumnos únicos activos, horas invertidas y `% de aprobación`.
2. **`vw_license_adoption_roi`**: Una fila por colaborador combinando `dim_members` y `fact_learning_activities` con su clasificación vigente (`Activo`, `En Riesgo`, `Cohorte Previa`, `Sin Uso`) y días transcurridos desde su última sesión.
3. **`vw_team_skill_matrix`**: Cubo Equipo × Categoría Tecnológica listo para tablas dinámicas y mapas de calor ejecutivos.
4. **`vw_certification_candidates`**: Ranking de colaboradores en rutas oficiales con su `readiness_score` (`0–100`) y etiqueta de elegibilidad (`Listo para Voucher`, `En Progreso Avanzado`, `Inicial`).

---

## 4. Guía Paso a Paso: Conectar Looker Studio y Google Sheets

### Conectar en Looker Studio (3 minutos)
1. Abre `https://lookerstudio.google.com` y haz clic en **Crear -> Fuente de datos**.
2. Selecciona el conector nativo **BigQuery**.
3. Elige tu **Proyecto GCP** -> Conjunto de datos **`skillsboost_analytics`**.
4. Selecciona cualquiera de las vistas listas para negocio (por ejemplo **`vw_executive_kpis`** para tendencias directivas o **`vw_license_adoption_roi`** para seguimiento nominal de licencias).
5. En **Credenciales de datos**, elige *Credenciales del propietario* si deseas compartir el reporte ejecutivo con directivos que no tengan permisos directos sobre BigQuery, y haz clic en **Conectar**.

### Conectar en Google Sheets (Connected Sheets / Hojas Conectadas)
1. Abre una hoja de cálculo corporativa en Google Sheets.
2. En el menú superior selecciona **Datos -> Conectores de datos -> Conectar con BigQuery**.
3. Elige tu proyecto -> `skillsboost_analytics` -> `vw_license_adoption_roi` o `vw_certification_candidates`.
4. Ahora puedes crear tablas dinámicas vivas en Sheets y programar actualizaciones automáticas todas las mañanas sin exportar archivos manualmente.

---

## 5. Consultas SQL de Referencia para Analistas

### Evolución de Skill Badges y Uso de Licencias en el Tiempo
```sql
SELECT
  snapshot_date,
  contracted_licenses,
  accepted_invitations,
  pending_invitations,
  cumulative_learners,
  skills_badges_earned,
  labs_passed
FROM `TU_PROYECTO.skillsboost_analytics.fact_org_stats_snapshots`
ORDER BY snapshot_date DESC
LIMIT 90;
```

### Top 15 Colaboradores Listos para Examen Oficial de Certificación
```sql
SELECT
  learner_name,
  email,
  team_name,
  target_track,
  passed_modules,
  hours_spent,
  readiness_score
FROM `TU_PROYECTO.skillsboost_analytics.vw_certification_candidates`
WHERE readiness_status = 'Listo para Voucher'
ORDER BY readiness_score DESC, hours_spent DESC
LIMIT 15;
```
