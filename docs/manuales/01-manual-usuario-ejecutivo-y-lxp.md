# Manual 01: Guía de Uso Ejecutivo, Analítica y Talento LXP

Bienvenido al **Manual Oficial de Usuario** de la plataforma **Google Skills for Organizations Dashboard**. Esta guía explica cómo aprovechar los **15 módulos estratégicos** del tablero para maximizar el retorno de inversión (ROI) del contrato de capacitación, acelerar certificaciones oficiales de Google Cloud y cerrar brechas técnicas por equipo.

---

## 1. Navegación General y Barra de Estado Superior

Al ingresar al portal encontrarás dos barras permanentes en la parte superior:

### 1.1 Indicadores del Encabezado Principal
- **Insignia de Entorno (`Cloud Run • BigQuery`)**: Confirma que el tablero opera sobre Google Cloud Run conectado al Data Warehouse corporativo en BigQuery.
- **Insignia de Motor IA (`Vertex AI Gemini` / `Google Gemini`)**: Indica el modelo generativo activo para diagnósticos de talento, rutas curriculares y chat ejecutivo.
- **Modo de Datos (`API en Vivo` vs. `Datos Demo`)**:
  - **API en Vivo (Verde)**: Muestra registros reales sincronizados desde tu organización en Google Skills.
  - **Datos Demo (Ámbar)**: Muestra datos sintéticos de demostración para entrenamientos o pruebas sin afectar métricas reales.
- **Botón `Manuales`**: Abre en cualquier momento este Centro de Documentación interactivo con buscador por tema y descarga en formato Markdown.
- **Botón `Claves API`**: Visible en entornos locales o desbloqueados para configurar credenciales y ajustar el **Cupo Anual de Licencias Contratadas**. En modo nube protegido (`LOCK_SETTINGS_IN_CLOUD=true`), las llaves API permanecen blindadas en Secret Manager.
- **Botón `Sincronizar`**: Inicia una actualización contra Google Skills API v2 mostrando una franja azul de progreso en tiempo real.

### 1.2 Selector Rápido por Bloques Estratégicos
Debajo del encabezado puedes saltar entre las **3 familias de módulos** o navegar directamente con enlaces URL compartibles (`#overall`, `#adoption`, `#matrix`, etc.):
1. **Analítica (Azul)**: Diagnóstico cuantitativo de uso, licencias, equipos, madurez y horarios.
2. **Talento y Acción / LXP (Verde)**: Herramientas accionables para certificar, entrenar, encontrar expertos, lanzar campañas y gamificar.
3. **Dirección e IA (Rojo/Púrpura)**: Simulación financiera, gobierno por OKRs, reportes ejecutivos y consultoría conversacional.

---

## 2. Bloque 1: Módulos de Analítica (Pestañas 1 a 6)

### Módulo 1: Panel General (`#overall`)
**Audiencia ideal:** Dirección General, CIO/CTO y Dirección de Talento.
- **Tarjetas Superiores de KPIs**:
  - *Actividades Iniciadas y Completadas*: Volumen histórico total auditado.
  - *Tasa de Aprobación Global*: Porcentaje de actividades acreditadas satisfactoriamente (`Passed = true`).
  - *Horas Totales e Inversión Promedio por Persona*: Tiempo efectivo registrado en laboratorios prácticos y cursos.
  - *Colaboradores Activos Vigentes vs. Licencias Sin Uso*: Contrasta los usuarios con estudio activo en el año en curso frente al cupo contractual.
  - *Skill Badges Oficiales*: Insignias de habilidad validadas por Google Skills (`/stats`).
- **Tablas y Gráficos Clave**:
  - *Top Colaboradores Destacados*: Haz clic sobre cualquier nombre para abrir directamente su expediente individual en el módulo de Equipos.
  - *Capacitaciones Más Populares*: Cursos y laboratorios con mayor demanda y calificación promedio.
  - *Evolución Mensual de Aprendizaje*: Serie histórica de horas y finalizaciones para identificar picos de campaña o valles estacionales.

### Módulo 2: Adopción y Licencias — ROI (`#adoption`)
**Audiencia ideal:** Compras TI, Recursos Humanos, Administradores del Contrato Google Skills.
- **Separación Clara entre Año Contractual Vigente e Historial Multi-Anual**:
  - Evita el error común de confundir *invitaciones históricas acumuladas* (que incluyen excolaboradores o asientos rotados de años previos) con la *ocupación real del pool vigente* (ej. 500 asientos concurrentes).
- **Clasificación Automática de Estado por Colaborador**:
  | Estado | Criterio de Clasificación | Acción Recomendada |
  | :--- | :--- | :--- |
  | **Activo** | Tiene actividad registrada en el año actual y estudió hace `<= 30` días. | Mantener en ruta de especialización o certificación. |
  | **En Riesgo** | Estudió este año, pero acumula **`> 30` días sin actividad**. | Enviar campaña preventiva desde *Campañas de Activación*. |
  | **Cohorte Previa** | Tuvo actividad en años anteriores, pero registra **0 actividades en el año vigente**. | Re-activar con reto práctico o liberar asiento para nuevo ingreso. |
  | **Sin Uso** | Invitación enviada/aceptada con **0 minutos históricos** de estudio. | Prioridad #1 para reasignación de licencia tras recordatorio. |
- **Cursos con Mayor Abandono (*Drop-off*)**: Identifica contenidos donde los alumnos inician pero no acreditan, permitiendo programar sesiones de acompañamiento técnico.

### Módulo 3: Equipos y Perfiles (`#teams`)
**Audiencia ideal:** Gerentes de Ingeniería, Líderes de Tribu/Célula y Mentores Técnicos.
- **Equipos Oficiales + Organización General**: Si existen colaboradores con licencia corporativa que aún no han sido asignados a un sub-equipo en el portal de Google Skills, el sistema los agrupa automáticamente en **`Organización General (Sin Equipo)`** para garantizar visibilidad del 100% del contrato.
- **Expediente Individual (*Member Drilldown*)**: Al seleccionar cualquier estudiante verás su historial completo de cursos/laboratorios, distribución por dominio tecnológico y el botón **"Generar Diagnóstico de Perfil con IA"**, que evalúa:
  - Nivel de madurez (*Inicial, Intermedio, Avanzado o Champion Cloud*).
  - Rol técnico inferido y puntaje de preparación (`0–100`) para presentar examen oficial de certificación Google Cloud.
  - Siguientes 3 pasos concretos de estudio seleccionados del catálogo real.

### Módulo 4: Comparador Ejecutivo (`#benchmarking`)
**Audiencia ideal:** VP de Tecnología, PMO y Líderes de Transformación Digital.
- ** Tabla de Posiciones por Índice de Eficiencia (`0–100`)**: Pondera de forma equilibrada tres factores para que equipos pequeños y grandes compitan con justicia:
  - Participación activa del equipo (`40%`), promedio de horas por integrante (`35%`) y tasa de aprobación efectiva (`25%`).
- **Detector de Laboratorios de Fricción**: Compara la duración estimada en catálogo contra los minutos reales invertidos y el número de intentos fallidos (`Alta`, `Media` o `Baja` fricción).

### Módulo 5: Matriz de Habilidades (`#matrix`)
**Audiencia ideal:** Arquitectura Empresarial, Seguridad de la Información y Líderes de Práctica.
- Cruza a todos los equipos contra las **6 Categorías Core de Google Cloud**:
  1. *Cloud Infrastructure*
  2. *Data & Analytics*
  3. *AI & Machine Learning*
  4. *Cloud Security & IAM*
  5. *Containers & Kubernetes*
  6. *DevOps & SRE*
- **Panel de Brechas Críticas**: Señala automáticamente qué equipos tienen cobertura nula o incipiente en dominios estratégicos (por ejemplo, un equipo de plataforma sin horas en *Cloud Security & IAM*).

### Módulo 6: Hábitos y Horarios — Learning Pulse (`#pulse`)
**Audiencia ideal:** Cultura Organizacional, Bienestar y Recursos Humanos.
- Analiza las marcas de tiempo ajustadas al huso horario corporativo configurado (`CORPORATE_UTC_OFFSET`) para medir qué porcentaje del aprendizaje ocurre en **horario laboral (Lun–Vie 08:00–19:00)**, **fuera de horario** o en **fines de semana**.
- Emite una recomendación automática de política interna (ej. instituir bloques protegidos *"Viernes de Cloud Learning"* cuando el estudio recae excesivamente en noches o fines de semana).

---

## 3. Bloque 2: Módulos de Talento y Acción — LXP (Pestañas 7 a 12)

### Módulo 7: Certificaciones y Candidatos a Voucher (`#certifications`)
- Rastrea el avance en rutas oficiales (*Learning Paths* y tracks de certificación) y clasifica automáticamente a los estudiantes en:
  - **Listo para Voucher**: Alta completitud de módulos prácticos, horas sólidas y excelente promedio de calificación.
  - **En Progreso Avanzado**: Candidatos ideales para un *bootcamp* de cierre de 2 a 3 semanas.
  - **Inicial**: En etapa temprana de la ruta.

### Módulo 8: Rutas con IA — Curriculum Builder (`#curriculum`)
- Selecciona un **Equipo**, escribe el **Rol Objetivo** (ej. *Ingeniero de Datos en BigQuery y Vertex AI*), define el **número de semanas (1–12)** y las **horas disponibles por semana**.
- Gemini analiza las brechas actuales de ese equipo en la Matriz de Habilidades y construye un **plan semanal estructurado** utilizando exclusivamente cursos y laboratorios reales con enlaces directos del catálogo de Google Skills. Los planes quedan guardados en BigQuery para consulta de toda la organización.

### Módulo 9: Buscador de Talento Interno (`#talent`)
- Funciona como un motor de búsqueda de *Subject Matter Experts (SMEs)* internos: escribe cualquier habilidad o servicio (`Kubernetes`, `BigQuery`, `Terraform`, `Vertex AI`, `IAM`) y localiza al instante quiénes ya aprobaron laboratorios prácticos verificados, clasificados en **Champion Oro**, **Especialista Plata** y **Practicante Bronce**.

### Módulo 10: Campañas de Activación — Nudge Hub (`#campaigns`)
- Selecciona uno de los 4 segmentos precalculados (*Licencias Sin Uso*, *En Riesgo +30 días*, *Candidatos a Voucher* o *Reconocimiento Alto Desempeño*), elige el canal (**Correo Electrónico** o **Google Chat / Espacios**) y el tono (**Motivacional**, **Ejecutivo** o **Urgente**).
- La IA redacta el asunto, el cuerpo persuasivo con un laboratorio rápido recomendado para romper la inercia y la lista de destinatarios lista para copiar.

### Módulo 11: Liga XP y Logros (`#gamification`)
- Impulsa la sana competencia interna mediante puntos de experiencia (**XP**) otorgados por laboratorios aprobados, cursos completados y calificaciones perfectas (`100%`), destacando al *Estudiante del Mes*, *Equipo Más Veloz* y *Maestro de Laboratorios*.

### Módulo 12: Catálogo Interactivo (`#catalog`)
- Permite buscar por palabra clave y filtrar todo el acervo contratado por tipo (*Lab, Course, Path, Certification*), categoría, nivel e idioma disponible.

---

## 4. Bloque 3: Módulos de Dirección e IA (Pestañas 13 a 15)

### Módulo 13: Simulador Financiero (`#finance`)
- Modela escenarios interactivos ajustando el **costo anual por asiento**, el **costo unitario de voucher de certificación** y el **valor hora equivalente de capacitación externa**, cuantificando el ahorro por recuperación de licencias inactivas y el presupuesto óptimo de exámenes.

### Módulo 14: OKRs Trimestrales y Reportes (`#goals`)
- **Planeador de OKRs**: Crea o elimina metas trimestrales para toda la organización (`org-all`) o para un equipo específico definiendo meta de *horas por integrante*, *% de adopción activa* y *completados en una categoría foco*. El semáforo evalúa en vivo el estatus (`Cumplido`, `En Camino`, `En Riesgo`, `Atrasado`).
- **Informe Ejecutivo Mensual con IA**: Genera en un clic una minuta directiva en formato Markdown con resumen ejecutivo, logros, riesgos y plan de acción de 30 días.
- **Exportación Oficial CSV (Excel)**: Descarga al instante con codificación UTF-8 con acentos limpios en Microsoft Excel:
  - `reporte-adopcion-licencias.csv`: Sábana completa del padrón de colaboradores, estatus de riesgo y días sin actividad.
  - `sabana-actividades-capacitacion.csv`: Detalle transaccional de todas las actividades, puntajes, minutos y fechas.

### Módulo 15: Chat de Inteligencia (`#ai`)
- Conversa en lenguaje natural con el **Asesor Principal de Gestión del Conocimiento & Talento Cloud**. Puedes hacer preguntas como:
  - *"¿Qué tres equipos tienen mayor riesgo de desaprovechar sus licencias este trimestre y qué plan concreto propones?"*
  - *"¿Quiénes son los 5 mejores candidatos para certificarse como Professional Data Engineer?"*

---

## 5. Glosario Rápido de Reglas de Cálculo Oficiales

- **Actividad Aprobada / Completada (`isSuccessfulCompletion`)**: En Google Skills API v2, un laboratorio abandonado o fallido también registra fecha de término (`Date completed`), pero marca `Passed = "false"`. Por exactitud ejecutiva, el tablero contabiliza como **completada/acreditada únicamente cuando `Passed === "true"`**.
- **Tasa de Activación Anual (`activationRate`)**: `(Colaboradores únicos con actividad en el año en curso / Cupo de licencias contratadas) × 100`.
- **Asientos Rotados Estimados**: Diferencia entre las invitaciones aceptadas históricas acumuladas desde el inicio de la organización y el cupo vigente actual cuando el histórico supera al pool anual.
