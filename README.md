# SkillsBoost Analytics & LXP Suite — Google Skills for Organizations (v1.1)

Plataforma integral de código abierto para analítica ejecutiva, gestión de licencias (ROI), madurez técnica y aceleración de talento LXP compatible con **Google Skills for Organizations API v2**, diseñada para operar tanto en **Modo Local** como en arquitectura empresarial **Google Cloud Run + BigQuery Data Warehouse + Vertex AI (Gemini)**.

> **Aviso de Código Abierto:** Este repositorio es una plantilla independiente y de código abierto (*Open Source*, bajo licencia Apache-2.0) que consume la API pública de reportes de Google Skills for Organizations v2. No es un producto oficial soportado por Google.

---

## Arquitectura Cloud-Native en Google Cloud

La solución implementa una arquitectura híbrida de alto desempeño gobernada por **Terraform**:

1. **Google BigQuery (`skillsboost_analytics`)**: Fuente oficial de verdad (*Source of Truth*) con 8 tablas particionadas mensualmente y clusterizadas, deduplicación incremental idempotente (`MERGE`), historial de instantáneas de licencias y **4 vistas SQL listas para conectar a Looker Studio o Connected Sheets**.
2. **Google Cloud Run (Web Service)**: Servidor Express + SPA React 19 con 15 módulos interactivos. Hidrata índices en memoria desde BigQuery al iniciar para entregar tiempos de respuesta sub-milisegundo en todas las pestañas y persiste cambios de OKRs y rutas curriculares en tiempo real (*Write-Through*).
3. **Cloud Run Job + Cloud Scheduler**: Worker desatendido que ejecuta sincronizaciones nocturnas de larga duración (hasta 60 min para organizaciones empresariales de 500+ licencias) sin afectar al portal web y notifica el refresco automático de caché.
4. **Vertex AI / Gemini + Secret Manager**: Generación de rutas curriculares semanales, diagnósticos individuales de certificación, campañas de activación (*nudges*), informes ejecutivos mensuales y chat conversacional autenticado mediante Service Account (ADC) sin exponer llaves en el navegador.

---

## Mapa de los 15 Módulos de la Plataforma

| Bloque | Módulo | Propósito Principal |
| :--- | :--- | :--- |
| **Analítica** | **1. Panel General** | KPIs globales, horas de estudio, Skill Badges, top colaboradores y evolución temporal. |
| **Analítica** | **2. Adopción y Licencias** | Embudo de activación del contrato anual vs. histórico, asientos sin uso y riesgo de abandono (+30 días). |
| **Analítica** | **3. Equipos y Perfiles** | Métricas por gerencia/equipo, expediente individual y evaluación de elegibilidad con IA. |
| **Analítica** | **4. Comparador Ejecutivo** | Ranking de eficiencia compuesta (`0-100`) entre equipos y detección de laboratorios con alta fricción. |
| **Analítica** | **5. Matriz de Habilidades** | Mapa de calor Equipo × 6 dominios Cloud y detección automática de brechas críticas. |
| **Analítica** | **6. Hábitos y Horarios** | Distribución de estudio en horario laboral vs. extra-laboral y fines de semana (*Learning Pulse*). |
| **Talento y Acción** | **7. Certificaciones** | Seguimiento de rutas oficiales y priorización de candidatos *Listos para Voucher*. |
| **Talento y Acción** | **8. Rutas con IA** | Diseñador automático de planes de estudio semanales por rol usando cursos reales del catálogo. |
| **Talento y Acción** | **9. Buscador de Talento** | Directorio interno de especialistas verificados (*Champion Oro, Plata y Bronce*). |
| **Talento y Acción** | **10. Campañas de Activación** | Segmentación inteligente y redacción con IA de mensajes para Correo o Google Chat. |
| **Talento y Acción** | **11. Liga XP y Logros** | Gamificación corporativa, Salón de la Fama, puntos XP e insignias por equipo e individuo. |
| **Talento y Acción** | **12. Catálogo** | Explorador filtrable del catálogo oficial de cursos, laboratorios, rutas y exámenes. |
| **Dirección e IA** | **13. Simulador Financiero** | Modelado interactivo de retorno de inversión, reasignación de licencias y presupuesto de vouchers. |
| **Dirección e IA** | **14. OKRs y Reportes** | Metas trimestrales por equipo, informe ejecutivo mensual con IA y exportación CSV para Excel. |
| **Dirección e IA** | **15. Chat de Inteligencia** | Consultor conversacional conectado en vivo a todas las métricas de la organización. |

---

## Inicio Rápido

### 1. Ejecución en Modo Local (Desarrollo o Demo Instantánea)

```bash
npm install
cp .env.example .env
npm run dev
```

Abre `http://localhost:3000`. Si aún no configuras claves de Google Skills API v2, la aplicación inicia automáticamente con un conjunto rico de **Datos de Demostración**.

### 2. Despliegue Guiado en Google Cloud (Terraform Interactivo)

Para montar toda la infraestructura en GCP (**BigQuery + Cloud Run + Cloud Run Sync Job + Cloud Scheduler + Secret Manager + Artifact Registry**) mediante un asistente paso a paso en español:

```bash
npm run deploy:wizard
```

Para simular y previsualizar el archivo `terraform/terraform.tfvars` sin tocar recursos en la nube:

```bash
npm run deploy:wizard -- --dry-run
```

### 3. Comandos de Portabilidad y Migración con BigQuery

```bash
# Verificar integridad y limpieza de secretos del almacén local
npm run data:verify

# Crear/verificar Dataset, 8 tablas particionadas y 4 vistas BI en BigQuery
GCP_PROJECT_ID="tu-proyecto" npm run data:init-bq

# Migrar datos locales (.data/store.json) hacia BigQuery Data Warehouse
GCP_PROJECT_ID="tu-proyecto" npm run data:push-bq

# Descargar datos desde BigQuery hacia entorno local (.data/store.json)
GCP_PROJECT_ID="tu-proyecto" npm run data:pull-bq
```

---

## Biblioteca Oficial de Manuales

Toda la documentación operativa se encuentra en `docs/manuales/` y también está integrada dentro del botón **"Manuales"** en la barra superior de la aplicación web:

1. **01 • Manual de Usuario Ejecutivo y LXP** (`docs/manuales/01-manual-usuario-ejecutivo-y-lxp.md`): Guía funcional completa de los 15 módulos, casos de uso directivos y glosario de fórmulas.
2. **02 • Manual de Administración y Operación en Cloud Run** (`docs/manuales/02-manual-administrador-y-operacion-cloud.md`): Gestión de claves API, Secret Manager, seguridad IAM/IAP/Basic Auth, Cloud Run Jobs y resolución de problemas.
3. **03 • Diccionario de Datos BigQuery y Guía Looker Studio** (`docs/manuales/03-manual-datos-bigquery-y-looker.md`): Esquema detallado de las 8 tablas, las 4 vistas BI, consultas SQL optimizadas y conexión con Looker Studio.
4. **04 • Manual de Terraform Interactivo e IaC** (`docs/manuales/04-manual-terraform-interactivo.md`): Guía paso a paso del instalador interactivo, variables de Terraform, integración CI/CD y mantenimiento.
