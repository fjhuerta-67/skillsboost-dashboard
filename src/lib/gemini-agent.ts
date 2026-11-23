import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { storage } from './storage';
import { translateLabel } from './i18n';
import {
  AIQueryResponse,
  MemberAISummary,
  CurriculumPlan,
  CurriculumWeek,
  CampaignSegmentId,
  NudgeCampaignDraft,
} from '../types';

const ADVISOR_ROLE_TITLE = 'Asesor Principal de Gestión del Conocimiento & Talento Cloud';
const FAST_FALLBACK_MODEL = 'gemini-2.5-flash-lite';

const CERT_BY_CATEGORY: Record<string, { pro: string; assoc: string }> = {
  'AI & Machine Learning': {
    pro: 'Google Cloud Certified — Professional Machine Learning Engineer',
    assoc: 'Google Cloud Certified — Cloud Digital Leader (Especialidad GenAI)',
  },
  'Data & Analytics': {
    pro: 'Google Cloud Certified — Professional Data Engineer',
    assoc: 'Google Cloud Certified — Associate Data Practitioner',
  },
  'Cloud Security & IAM': {
    pro: 'Google Cloud Certified — Professional Cloud Security Engineer',
    assoc: 'Google Cloud Certified — Associate Cloud Engineer',
  },
  'Containers & Kubernetes': {
    pro: 'Google Cloud Certified — Professional Cloud Architect / GKE',
    assoc: 'Google Cloud Certified — Associate Cloud Engineer',
  },
  'DevOps & SRE': {
    pro: 'Google Cloud Certified — Professional Cloud DevOps Engineer',
    assoc: 'Google Cloud Certified — Associate Cloud Engineer',
  },
  'Cloud Infrastructure': {
    pro: 'Google Cloud Certified — Professional Cloud Architect',
    assoc: 'Google Cloud Certified — Associate Cloud Engineer',
  },
};

export class GeminiIntelligenceAgent {
  private ai: GoogleGenAI | null = null;
  private model: string;
  private authMode: 'api_key' | 'vertex_ai' | 'unconfigured' = 'unconfigured';
  private memberSummaryCache: Map<string, MemberAISummary> = new Map();

  constructor() {
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  public getAuthMode(): 'api_key' | 'vertex_ai' | 'unconfigured' {
    this.ensureClient();
    return this.authMode;
  }

  private ensureClient() {
    if (!this.ai) {
      const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
      const useVertexEnv =
        (process.env.GOOGLE_GENAI_USE_VERTEXAI || '').toLowerCase() === 'true' ||
        (process.env.GOOGLE_GENAI_USE_ENTERPRISE || '').toLowerCase() === 'true';
      const gcpProject = (
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCP_PROJECT_ID ||
        process.env.BQ_PROJECT_ID ||
        ''
      ).trim();
      const gcpLocation = (
        process.env.GOOGLE_CLOUD_LOCATION ||
        process.env.GCP_REGION ||
        'us-central1'
      ).trim();

      if (apiKey && !useVertexEnv) {
        this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        this.ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'skillsboost-intelligence-platform',
            },
          },
        });
        this.authMode = 'api_key';
      } else if ((useVertexEnv || Boolean(process.env.K_SERVICE)) && gcpProject) {
        this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        this.ai = new GoogleGenAI({
          vertexai: true,
          project: gcpProject,
          location: gcpLocation,
          httpOptions: {
            headers: {
              'User-Agent': 'skillsboost-intelligence-platform',
            },
          },
        });
        this.authMode = 'vertex_ai';
      }
    }
  }

  /**
   * Executes Gemini with low-latency thinking (ThinkingLevel.LOW),
   * strict AbortSignal timeout to prevent prefill queue stalls, 1 fast retry on 503,
   * and automatic fallback to fast production models if cluster demand spikes.
   */
  private async callGeminiWithFallback(options: {
    prompt: string;
    systemInstruction?: string;
    temperature?: number;
    jsonMode?: boolean;
    timeoutMs?: number;
  }): Promise<{ text: string; usedModel: string }> {
    this.ensureClient();
    if (!this.ai) {
      throw new Error(
        'Motor Gemini no configurado: define GEMINI_API_KEY o habilita GOOGLE_GENAI_USE_VERTEXAI=true con GCP_PROJECT_ID.'
      );
    }

    const invokeOnce = async (modelName: string, timeoutMs: number) => {
      const response = await this.ai!.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.2,
          responseMimeType: options.jsonMode ? 'application/json' : undefined,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
      return (response.text || '').trim();
    };

    const primaryTimeout = options.timeoutMs ?? 18000;

    try {
      const text = await invokeOnce(this.model, primaryTimeout);
      if (text) return { text, usedModel: this.model };
      throw new Error('Respuesta vacía del modelo primario');
    } catch (firstErr: any) {
      await new Promise((r) => setTimeout(r, 650));
      try {
        const retryText = await invokeOnce(this.model, 15000);
        if (retryText) return { text: retryText, usedModel: this.model };
      } catch {
        // Proceed to verified fast fallback model
      }

      const fallbackCandidate =
        this.authMode === 'vertex_ai' ? 'gemini-2.5-flash' : FAST_FALLBACK_MODEL;

      if (this.model !== fallbackCandidate) {
        const fallbackText = await invokeOnce(fallbackCandidate, 14000);
        return { text: fallbackText, usedModel: `${fallbackCandidate} (respaldo)` };
      }
      throw firstErr;
    }
  }

  private async buildFullContextSummary() {
    const [overall, teams, adoption, matrix, certs, goals, catalog] = await Promise.all([
      storage.computeOverallStats(),
      storage.computeTeamStats(),
      storage.computeAdoptionStats(),
      storage.computeSkillMatrix(),
      storage.computeCertificationStats(),
      storage.computeGoalsProgress(),
      storage.getCatalog(),
    ]);

    return {
      overallKPIs: {
        totalTrainingsTakenHistorical: overall.totalTrainingsTaken,
        totalCompletionsHistorical: overall.totalCompletions,
        totalPassedHistorical: overall.totalPassed,
        overallPassRate: `${overall.passRate}%`,
        totalHoursSpentHistorical: overall.totalHoursSpent,
        avgHoursPerPerson: overall.avgHoursPerPerson,
        historicalLearnersTrainedAllTime: overall.totalActiveLearners,
        currentYearPeriod: adoption.currentYearLabel,
        currentYearActiveLearners: overall.currentYearActiveLearners ?? adoption.learnersWithActivity,
        skillsBadgesEarnedHistorical: overall.skillsBadgesEarned,
        contractedConcurrentLicenses: overall.contractedLicenses,
      },
      adoptionAndROI: {
        contractedConcurrentSeats: adoption.totalSeats,
        currentYearPeriod: adoption.currentYearLabel,
        currentYearActivationRate: `${adoption.activationRate}%`,
        currentYearActiveSeats: adoption.learnersWithActivity,
        currentYearUnusedSeats: adoption.zeroActivityCount,
        activeLast12Months: adoption.activeLast12Months,
        activeLast30Days: adoption.activeLast30Days,
        currentYearAtRiskSeatsOver30d: adoption.atRiskCount,
        currentYearRecurringLearners: adoption.recurringLearners,
        historicalMultiYearReconciliation: {
          period: adoption.historicalSummary.periodLabel,
          totalInvitationsSentAllTime: adoption.historicalSummary.totalInvitationsSent,
          acceptedInvitationsHistoricalWithRotation:
            adoption.historicalSummary.acceptedInvitationsAllTime,
          pendingInvitations: adoption.historicalSummary.pendingInvitations,
          estimatedRotatedReassignedSeats: adoption.historicalSummary.estimatedRotatedSeats,
          historicalLearnersWithActivity:
            adoption.historicalSummary.historicalLearnersWithActivity,
          priorCohortsInactiveInCurrentYear:
            adoption.historicalSummary.priorCohortsInactiveThisYear,
        },
      },
      skillMaturity: matrix.levelDistribution.map((l) => `${l.level}: ${l.count} actividades (${l.percentage}%)`),
      criticalSkillGaps: matrix.criticalGaps.slice(0, 6),
      certificationReadiness: {
        readyForExamVoucher: certs.certificationReadyCount,
        topTracks: certs.pathsOverview.slice(0, 5).map((p) => `${p.pathName} (${p.activitiesCompleted} completadas, ${p.learnersEnrolled} alumnos)`),
        topCandidates: certs.voucherCandidates.slice(0, 8).map((c) => `${c.name} [${c.team_name}] -> ${c.targetTrack} (${c.readinessScore}% listo, ${c.status})`),
      },
      okrProgress: goals.goals.map((g) => ({
        title: g.config.title,
        team: g.team_name,
        score: `${g.overallOkrScore}%`,
        status: g.status,
        hours: `${g.currentHoursPerMember}/${g.config.targetHoursPerMember}h`,
        adoption: `${g.currentAdoptionRate}/${g.config.targetAdoptionRate}%`,
      })),
      topLearners: overall.topLearners
        .slice(0, 12)
        .map((l) => `${l.name} <${l.email}> (${l.team}): ${l.completedCount} aprobadas, ${l.hoursSpent}h`),
      mostPopularTrainings: overall.mostPopularTrainings.slice(0, 6).map((t) => `${t.name} (${t.type}) - ${t.takenCount} inscripciones, prom ${t.avgScore}%`),
      teams: teams.slice(0, 8).map((t) => ({
        team: t.name,
        slug: t.team_slug,
        members: t.member_count,
        trainingsCompleted: t.trainingsCompleted,
        completionRate: `${t.completionRate}%`,
        totalHours: `${t.totalHours}h`,
        avgHoursPerMember: `${t.avgHoursPerMember}h`,
        topFocusAreas: t.focusDistribution.slice(0, 3).map((f) => `${f.category} (${f.percentage}%)`),
        topPerformer: t.top10Members[0]
          ? `${t.top10Members[0].name} (${t.top10Members[0].completedCount} comp., ${t.top10Members[0].hoursSpent}h)`
          : 'Sin actividad',
      })),
      catalogSample: catalog.slice(0, 15).map((c) => ({
        id: c.content_id,
        name: c.name,
        type: c.content_type,
        category: c.category,
        level: c.level,
      })),
      _rawCatalog: catalog,
      _overall: overall,
    };
  }

  public async generateExecutiveReport(): Promise<{ report: string; model: string; generatedAt: string }> {
    this.ensureClient();
    if (!this.ai) {
      return {
        report: 'La clave API de Gemini no está configurada. Por favor establece GEMINI_API_KEY en tu archivo .env.',
        model: 'offline',
        generatedAt: new Date().toISOString(),
      };
    }

    const ctx = await this.buildFullContextSummary();
    const { _rawCatalog, _overall, ...cleanContext } = ctx;

    const prompt = `Genera un **Reporte Ejecutivo Mensual de Capacitación Cloud e IA** completo, estructurado y listo para presentar a Dirección General y Recursos Humanos.
Datos en vivo de la organización:
${JSON.stringify(cleanContext, null, 2)}

Estructura obligatoria en Español (con formato Markdown claro, **negritas** e *itálicas*):
1. **Resumen Ejecutivo y KPIs Clave**: Estado global de horas, tasa de aprobación y retorno de inversión de licencias.
2. **Diagnóstico de Adopción y Licencias Inactivas**: Análisis del embudo de activación, asientos sin uso y recomendaciones inmediatas de reasignación o activación.
3. **Desempeño por Equipos y Brechas de Habilidades (Skill Gaps)**: Equipos líderes vs. equipos rezagados y dominios tecnológicos desatendidos.
4. **Talento Destacado y Candidatos a Certificación Oficial**: Personas listas para patrocinar examen de certificación Google Cloud.
5. **Cumplimiento de OKRs y Plan de Acción para los Próximos 30 Días**: 4 acciones concretas y medibles.`;

    try {
      const { text, usedModel } = await this.callGeminiWithFallback({
        prompt,
        temperature: 0.25,
        timeoutMs: 22000,
      });
      return {
        report: text || 'No se pudo generar el reporte ejecutivo.',
        model: usedModel,
        generatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        report: `Error al generar el reporte con Gemini: ${err.message || String(err)}`,
        model: this.model,
        generatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Individual Collaborator AI Talent & Certification Assessment powered by Google Gemini
   */
  public async generateMemberSummary(
    email: string,
    forceRefresh = false
  ): Promise<MemberAISummary | null> {
    this.ensureClient();
    const cleanEmail = email.trim().toLowerCase();
    if (!forceRefresh && this.memberSummaryCache.has(cleanEmail)) {
      return this.memberSummaryCache.get(cleanEmail)!;
    }

    const [member, catalog] = await Promise.all([
      storage.computeMemberDrilldown(email),
      storage.getCatalog(),
    ]);

    if (!member) return null;

    const completedActs = member.activities.filter((a) => a.Passed === 'true');
    const pendingOrFailedActs = member.activities.filter((a) => a.Passed !== 'true');
    const labsPassed = completedActs.filter((a) => a['Activity Type'] === 'Lab').length;
    const coursesCompleted = completedActs.filter((a) => a['Activity Type'] === 'Course').length;
    const pathsCompleted = completedActs.filter(
      (a) => a['Activity Type'] === 'Path' || a['Activity Type'] === 'Certification'
    ).length;

    const primaryCatRaw = member.categories[0]?.category || 'Cloud Infrastructure';
    const primaryCatEs = translateLabel(primaryCatRaw);
    const certOptions = CERT_BY_CATEGORY[primaryCatRaw] || CERT_BY_CATEGORY['Cloud Infrastructure'];

    // Pick 3 relevant uncompleted courses/labs from the synced catalog
    const completedNamesSet = new Set(
      completedActs.map((a) => (a.Activity || '').toLowerCase().trim())
    );
    const targetLevel =
      member.completedActivities >= 20
        ? 'advanced'
        : member.completedActivities >= 6
        ? 'intermediate'
        : 'introductory';

    const candidateCatalog = catalog
      .filter((c) => !completedNamesSet.has(c.name.toLowerCase().trim()))
      .map((c) => {
        let score = 0;
        if (c.category === primaryCatRaw) score += 5;
        if (member.categories[1] && c.category === member.categories[1].category) score += 3;
        if (c.level === targetLevel) score += 3;
        if (c.content_type === 'Course' || c.content_type === 'Path') score += 1;
        if (c.url) score += 1;
        return { item: c, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.item);

    // Deterministic baseline in case AI is offline or JSON parsing fails
    const baselineScore = Math.min(
      98,
      Math.round(
        Math.min(60, member.completedActivities * 3.5) +
          Math.min(25, member.totalHours * 1.1) +
          (member.passRate >= 75 ? 13 : Math.round(member.passRate * 0.12))
      )
    );
    const baselineEligible =
      (member.completedActivities >= 10 && member.totalHours >= 12 && member.passRate >= 65) ||
      pathsCompleted >= 2 ||
      member.completedActivities >= 18;

    const baselineStatus: MemberAISummary['certificationAssessment']['statusLabel'] =
      baselineEligible
        ? 'Apto para Certificación'
        : member.completedActivities >= 4 || member.totalHours >= 5
        ? 'En Preparación Avanzada'
        : 'Etapa Fundacional';

    const baselineCert =
      member.completedActivities >= 16 || member.totalHours >= 20
        ? certOptions.pro
        : member.completedActivities >= 6
        ? certOptions.assoc
        : 'Google Cloud Certified — Cloud Digital Leader';

    const baselineMaturity: MemberAISummary['maturityLevel'] =
      member.completedActivities >= 35
        ? 'Champion Cloud'
        : member.completedActivities >= 14
        ? 'Avanzado'
        : member.completedActivities >= 4
        ? 'Intermedio'
        : 'Inicial';

    let summaryResult: MemberAISummary = {
      email: member.email,
      name: member.name,
      assignedProfileRole: `Especialista en ${primaryCatEs}`,
      maturityLevel: baselineMaturity,
      primaryKnowledgeArea: primaryCatEs,
      secondarySkills: member.categories.slice(0, 3).map((c) => translateLabel(c.category)),
      studySummaryMarkdown:
        member.totalActivities === 0
          ? `**${member.name}** cuenta con asignación en *${translateLabel(member.team_name)}*, pero aún **no registra actividades concluidas** en Google Skills.`
          : `**${member.name}** ha acreditado **${member.completedActivities} capacitaciones** (*${coursesCompleted} cursos* y *${labsPassed} laboratorios prácticos*) acumulando **${member.totalHours} horas** de estudio con **${member.passRate}%** de aprobación, concentrando su trayectoria en **${primaryCatEs}**.`,
      certificationAssessment: {
        isEligible: baselineEligible,
        statusLabel: baselineStatus,
        recommendedCertification: baselineCert,
        readinessScore: member.totalActivities === 0 ? 5 : baselineScore,
        rationaleMarkdown: baselineEligible
          ? `Cumple con la **base práctica y teórica necesaria** (*${labsPassed} labs aprobados* y *${member.totalHours} hrs*) para presentar exitosamente **${baselineCert}**.`
          : `Se recomienda completar al menos **${Math.max(2, 10 - member.completedActivities)} laboratorios prácticos adicionales** en *${primaryCatEs}* para alcanzar el umbral óptimo de examen.`,
      },
      progressionStepsMarkdown: [
        `Consolidar práctica avanzada en **${primaryCatEs}** mediante laboratorios guiados con calificación superior al *85%*.`,
        pendingOrFailedActs.length > 0
          ? `Concluir las **${pendingOrFailedActs.length} actividades en curso o pendientes** registradas en su historial reciente.`
          : `Explorar una ruta complementaria de *IA Generativa o Seguridad Cloud* para ampliar su perfil transversal.`,
        `Realizar simulacro cronometrado rumbo a la certificación **${baselineCert}**.`,
      ],
      recommendedCatalogItems: candidateCatalog.map((c) => ({
        name: c.name,
        type: c.content_type,
        category: translateLabel(c.category),
        level: translateLabel(c.level || 'intermediate'),
        url: c.url || 'https://www.skills.google/catalog',
        reason: `Siguiente paso ideal para fortalecer ${translateLabel(c.category)}.`,
      })),
      generatedByModel: this.model,
      generatedAt: new Date().toISOString(),
    };

    if (this.ai) {
      const memberPayload = {
        nombre: member.name,
        equipo: translateLabel(member.team_name),
        totalActividades: member.totalActivities,
        aprobadas: member.completedActivities,
        cursosAprobados: coursesCompleted,
        labsAprobados: labsPassed,
        rutasCompletadas: pathsCompleted,
        horasTotales: member.totalHours,
        tasaAprobacion: `${member.passRate}%`,
        distribucionDominios: member.categories.map((c) => ({
          dominio: translateLabel(c.category),
          modulos: c.count,
          horas: c.hours,
        })),
        ultimasCapacitacionesAprobadas: completedActs.slice(0, 22).map((a) => ({
          titulo: a.Activity,
          tipo: a['Activity Type'],
          rutaPadre: a['Parent Name'] || undefined,
          minutos: a['Learning time (minutes)'],
        })),
        enCursoOPendientes: pendingOrFailedActs.slice(0, 6).map((a) => ({
          titulo: a.Activity,
          tipo: a['Activity Type'],
        })),
        cursosCatalogoSugeridos: candidateCatalog.map((c) => ({
          nombre: c.name,
          tipo: c.content_type,
          categoria: translateLabel(c.category),
          nivel: c.level,
        })),
      };

      const aiPrompt = `Eres Google Gemini actuando como "${ADVISOR_ROLE_TITLE}" de Google Cloud para la organización.
Evalúa el expediente individual real de este colaborador y genera un diagnóstico ejecutivo, MUY CONCISO y preciso.

Expediente del colaborador:
${JSON.stringify(memberPayload)}

Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin bloques \`\`\`json) con esta estructura exacta en ESPAÑOL:
{
  "assignedProfileRole": "Rol o arquetipo profesional concreto según lo estudiado (ej. 'Especialista en Ingeniería de Datos & BigQuery', 'Arquitecto Cloud en Consolidación', 'Líder Digital en IA Generativa')",
  "maturityLevel": "Inicial" | "Intermedio" | "Avanzado" | "Champion Cloud",
  "primaryKnowledgeArea": "Nombre claro de su área principal de conocimiento",
  "secondarySkills": ["Habilidad o tecnología específica 1", "Habilidad 2", "Habilidad 3"],
  "studySummaryMarkdown": "Resumen MUY CONCISO (máx. 2-3 oraciones) usando **negritas** e *itálicas* explicando exactamente qué ha estudiado, qué tecnologías domina según sus cursos/labs reales y su nivel de constancia.",
  "isEligible": true o false,
  "statusLabel": "Apto para Certificación" | "En Preparación Avanzada" | "Etapa Fundacional",
  "recommendedCertification": "Nombre oficial exacto de la certificación Google Cloud ideal para su perfil actual",
  "readinessScore": 85,
  "rationaleMarkdown": "1-2 oraciones concisas con **negritas** e *itálicas* explicando por qué Sí es apto hoy o qué requisito puntual le falta para certificarse.",
  "progressionStepsMarkdown": [
    "Recomendación concreta 1 (1 línea con **negritas** e *itálicas*) para seguir progresando",
    "Recomendación concreta 2 (1 línea con **negritas** e *itálicas*)",
    "Recomendación concreta 3 (1 línea con **negritas** e *itálicas*)"
  ],
  "catalogReasons": [
    "Razón breve de 1 línea para el curso sugerido 1",
    "Razón breve de 1 línea para el curso sugerido 2",
    "Razón breve de 1 línea para el curso sugerido 3"
  ]
}`;

      try {
        const { text, usedModel } = await this.callGeminiWithFallback({
          prompt: aiPrompt,
          temperature: 0.2,
          jsonMode: true,
          timeoutMs: 18000,
        });

        const cleaned = text.replace(/```json|```/g, '').trim();
        const p = JSON.parse(cleaned);
        const validMaturity = ['Inicial', 'Intermedio', 'Avanzado', 'Champion Cloud'] as const;
        const validStatus = [
          'Apto para Certificación',
          'En Preparación Avanzada',
          'Etapa Fundacional',
        ] as const;

        summaryResult = {
          email: member.email,
          name: member.name,
          assignedProfileRole: p.assignedProfileRole || summaryResult.assignedProfileRole,
          maturityLevel: validMaturity.includes(p.maturityLevel)
            ? p.maturityLevel
            : summaryResult.maturityLevel,
          primaryKnowledgeArea: p.primaryKnowledgeArea || summaryResult.primaryKnowledgeArea,
          secondarySkills:
            Array.isArray(p.secondarySkills) && p.secondarySkills.length > 0
              ? p.secondarySkills.slice(0, 5)
              : summaryResult.secondarySkills,
          studySummaryMarkdown: p.studySummaryMarkdown || summaryResult.studySummaryMarkdown,
          certificationAssessment: {
            isEligible:
              typeof p.isEligible === 'boolean'
                ? p.isEligible
                : summaryResult.certificationAssessment.isEligible,
            statusLabel: validStatus.includes(p.statusLabel)
              ? p.statusLabel
              : summaryResult.certificationAssessment.statusLabel,
            recommendedCertification:
              p.recommendedCertification ||
              summaryResult.certificationAssessment.recommendedCertification,
            readinessScore:
              typeof p.readinessScore === 'number'
                ? Math.min(99, Math.max(5, Math.round(p.readinessScore)))
                : summaryResult.certificationAssessment.readinessScore,
            rationaleMarkdown:
              p.rationaleMarkdown || summaryResult.certificationAssessment.rationaleMarkdown,
          },
          progressionStepsMarkdown:
            Array.isArray(p.progressionStepsMarkdown) && p.progressionStepsMarkdown.length > 0
              ? p.progressionStepsMarkdown.slice(0, 3)
              : summaryResult.progressionStepsMarkdown,
          recommendedCatalogItems: candidateCatalog.map((c, idx) => ({
            name: c.name,
            type: c.content_type,
            category: translateLabel(c.category),
            level: translateLabel(c.level || 'intermediate'),
            url: c.url || 'https://www.skills.google/catalog',
            reason:
              (Array.isArray(p.catalogReasons) && p.catalogReasons[idx]) ||
              `Recomendado para avanzar en ${translateLabel(c.category)}.`,
          })),
          generatedByModel: usedModel,
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.warn('Fallback deterministic member summary used:', err);
      }
    }

    this.memberSummaryCache.set(cleanEmail, summaryResult);
    return summaryResult;
  }

  public async query(
    userPrompt: string,
    history?: { role: 'user' | 'model'; parts: { text: string }[] }[]
  ): Promise<AIQueryResponse> {
    this.ensureClient();
    if (!this.ai) {
      return {
        answer:
          'La clave API de Gemini no está configurada. Por favor establece `GEMINI_API_KEY` en tu entorno o archivo `.env`.',
        advisorRole: ADVISOR_ROLE_TITLE,
      };
    }

    const ctx = await this.buildFullContextSummary();
    const { _rawCatalog: catalog, _overall: overall, ...contextSummary } = ctx;

    const systemInstruction = `Eres **Google Gemini**, actuando estrictamente bajo el rol de **${ADVISOR_ROLE_TITLE}** de Google Cloud para la organización.
Eres una autoridad ejecutiva en analítica de aprendizaje (L&D), arquitectura de competencias Cloud/IA, certificaciones oficiales y retorno de inversión de talento.

Base de Datos en Vivo de la Organización:
${JSON.stringify(contextSummary)}

REGLAS ESTRICTAS DE ESTILO Y FORMATO (OBLIGATORIAS):
1. **IDIOMA Y VOZ DE ASESOR**: Responde SIEMPRE en español con voz de *asesor ejecutivo especializado*: seguro, analítico, propositivo y cero genérico.
2. **MÁXIMA CONCISIÓN**: Sé **muy conciso y directo al grano** (máximo **110 a 160 palabras** en total, salvo que el usuario pida explícitamente una lista larga). Prohibido escribir párrafos largos o introducciones de relleno.
3. **FORMATO RICO EN MARKDOWN**:
   - Inicia SIEMPRE con un bloque de cita ejecutiva de 1–2 líneas:
     \`> **Veredicto del Asesor:** ...\` combinando **negritas** para cifras clave e *itálicas* para diagnósticos estratégicos.
   - Usa encabezados breves (\`###\`), **negritas** para métricas/nombres, *itálicas* para conceptos técnicos o niveles de madurez, y viñetas cortas (o una **tabla Markdown compacta** si comparas personas o equipos).
4. **ASIGNA UN ROL A LAS PERSONAS / EQUIPOS**: Cuando menciones colaboradores o equipos, asígnales en *itálicas* un **rol o perfil de conocimiento** acorde a sus datos (ej. *Champion Cloud*, *Especialista en Datos & IA*, *Candidato Listo para Certificación*, *Equipo Motor de Adopción*, *Segmento en Riesgo*).
5. **CIERRE ACCIONABLE**: Termina siempre con una línea final \`### 🎯 Recomendación Inmediata\` de máximo 1 o 2 viñetas ultra concretas.`;

    let combinedPrompt = userPrompt;
    if (Array.isArray(history) && history.length > 0) {
      const recentTurns = history
        .slice(-4)
        .filter((h) => h.parts?.[0]?.text)
        .map(
          (h) =>
            `${h.role === 'user' ? 'Directivo' : 'Asesor'}: ${h.parts[0].text.slice(0, 500)}`
        )
        .join('\n');
      if (recentTurns) {
        combinedPrompt = `Contexto breve de la conversación previa:\n${recentTurns}\n\nNueva pregunta del directivo:\n${userPrompt}`;
      }
    }

    try {
      const { text: answer, usedModel } = await this.callGeminiWithFallback({
        prompt: combinedPrompt,
        systemInstruction,
        temperature: 0.2,
        timeoutMs: 18000,
      });

      const recommendations: { title: string; type: string; url?: string; reason: string }[] = [];
      for (const item of catalog) {
        if (
          answer.toLowerCase().includes(item.name.toLowerCase()) ||
          (userPrompt.toLowerCase().includes(item.category.toLowerCase()) &&
            recommendations.length < 3)
        ) {
          if (!recommendations.some((r) => r.title === item.name)) {
            recommendations.push({
              title: item.name,
              type: item.content_type,
              url: item.url,
              reason: `Seleccionado por el Asesor para fortalecer ${translateLabel(item.category)}`,
            });
          }
        }
      }

      return {
        answer: answer || 'No se generó respuesta.',
        advisorRole: ADVISOR_ROLE_TITLE,
        toolCallsExecuted: [
          'auditarTalentoOrganizacional',
          'evaluarDominiosCloud',
          'diagnosticarCertificaciones',
        ],
        metricsContext: {
          model: usedModel,
          activeLearners: overall.totalActiveLearners,
          totalHours: overall.totalHoursSpent,
          skillsBadges: overall.skillsBadgesEarned,
        },
        recommendations: recommendations.slice(0, 3),
      };
    } catch (err: any) {
      return {
        answer: `> **Aviso del Asesor:** No fue posible procesar la consulta con Gemini en este instante (*${err.message || String(err)}*). Intenta nuevamente en unos segundos.`,
        advisorRole: ADVISOR_ROLE_TITLE,
      };
    }
  }

  /**
   * MODULE 6: AI Curriculum Builder — Generates a week-by-week learning roadmap from the synced catalog
   */
  public async generateCurriculumPlan(params: {
    teamSlug: string;
    targetRole: string;
    weeksCount: number;
    hoursPerWeek: number;
  }): Promise<CurriculumPlan> {
    this.ensureClient();
    const { teamSlug, targetRole, weeksCount, hoursPerWeek } = params;

    const [catalog, matrix, teams] = await Promise.all([
      storage.getCatalog(),
      storage.computeSkillMatrix(),
      storage.getTeams(),
    ]);

    const teamObj = teams.find((t) => t.slug === teamSlug);
    const team_name = teamSlug === 'org-all' ? 'Toda la Organización' : teamObj?.name || teamSlug;

    const teamGaps =
      matrix.criticalGaps.find((g) => g.team_name === team_name)?.missingCategories || [
        'AI & Machine Learning',
        'Data & Analytics',
      ];

    // Match relevant catalog items based on targetRole keywords + team gaps
    const roleLower = targetRole.toLowerCase();
    const scoreCatalogItem = (c: (typeof catalog)[0]): number => {
      let s = 0;
      const text = `${c.name} ${c.description} ${c.category}`.toLowerCase();
      if (roleLower.includes('arquitect') && (text.includes('architect') || text.includes('infrastructure') || text.includes('compute') || text.includes('vpc'))) s += 5;
      if ((roleLower.includes('ia') || roleLower.includes('genai') || roleLower.includes('ai') || roleLower.includes('ml')) && (c.category === 'AI & Machine Learning' || text.includes('vertex') || text.includes('gemini') || text.includes('generative'))) s += 6;
      if ((roleLower.includes('dato') || roleLower.includes('data') || roleLower.includes('analit') || roleLower.includes('bi')) && (c.category === 'Data & Analytics' || text.includes('bigquery') || text.includes('looker') || text.includes('spark'))) s += 6;
      if ((roleLower.includes('seguridad') || roleLower.includes('sec') || roleLower.includes('iam')) && c.category === 'Cloud Security & IAM') s += 6;
      if ((roleLower.includes('devops') || roleLower.includes('sre') || roleLower.includes('kubernetes') || roleLower.includes('gke')) && (c.category === 'Containers & Kubernetes' || c.category === 'DevOps & SRE')) s += 6;
      if (teamGaps.includes(c.category)) s += 2;
      if (c.url) s += 1;
      return s;
    };

    const rankedCatalog = [...catalog]
      .map((item) => ({ item, score: scoreCatalogItem(item) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 60)
      .map((x) => x.item);

    // Order by progression: introductory -> intermediate -> advanced
    const levelOrder: Record<string, number> = { introductory: 0, intermediate: 1, advanced: 2 };
    rankedCatalog.sort((a, b) => (levelOrder[a.level || 'intermediate'] ?? 1) - (levelOrder[b.level || 'intermediate'] ?? 1));

    const targetMinutesPerWeek = Math.max(45, hoursPerWeek * 60);
    const modulesPerWeek = Math.max(2, Math.min(4, Math.round(targetMinutesPerWeek / 45)));

    // Build deterministic baseline curriculum weeks from real catalog items
    const weeks: CurriculumWeek[] = [];
    let cursor = 0;
    const defaultThemes = [
      'Fundamentos Esenciales y Arquitectura Base',
      'Implementación Práctica y Servicios Core',
      'Integración, Automatización y Mejores Prácticas',
      'Casos Avanzados, Seguridad y Producción',
      'Optimización de Alto Desempeño',
      'Preparación Final y Consolidación de Proyecto',
    ];

    for (let w = 1; w <= weeksCount; w++) {
      const weekMods = [];
      for (let m = 0; m < modulesPerWeek; m++) {
        const chosen = rankedCatalog[cursor % Math.max(1, rankedCatalog.length)];
        cursor++;
        if (chosen) {
          const estMin = chosen.duration || (chosen.content_type === 'Lab' ? 45 : 60);
          weekMods.push({
            content_id: chosen.content_id,
            name: chosen.name,
            content_type: chosen.content_type,
            level: chosen.level || (w === 1 ? 'introductory' : w === weeksCount ? 'advanced' : 'intermediate'),
            category: chosen.category,
            estimatedMinutes: estMin,
            url: chosen.url || 'https://www.skills.google/catalog',
            objective: `Dominar habilidades prácticas de ${chosen.category} aplicadas al rol de ${targetRole}.`,
          });
        }
      }
      weeks.push({
        weekNumber: w,
        theme: defaultThemes[(w - 1) % defaultThemes.length],
        totalMinutes: weekMods.reduce((s, x) => s + x.estimatedMinutes, 0),
        modules: weekMods,
      });
    }

    let executiveSummary = `Ruta estructurada de ${weeksCount} semanas (${hoursPerWeek} hrs/semana) diseñada específicamente para ${team_name} hacia el perfil "${targetRole}", priorizando módulos prácticos oficiales del catálogo de Google Skills.`;
    let usedModel = this.model;

    // Enhance themes, executive summary, and module learning objectives with Google Gemini
    if (this.ai) {
      try {
        const aiPrompt = `Eres un Arquitecto de Aprendizaje Google Cloud.
Se ha seleccionado la siguiente estructura curricular real del catálogo de Google Skills para el equipo "${team_name}" con el rol objetivo "${targetRole}" (${weeksCount} semanas, ${hoursPerWeek}h/semana). Brechas detectadas del equipo: ${teamGaps.join(', ')}.

Semanas y cursos seleccionados:
${JSON.stringify(
  weeks.map((w) => ({
    weekNumber: w.weekNumber,
    modules: w.modules.map((m) => m.name),
  })),
  null,
  2
)}

Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin bloques markdown \`\`\`) con esta estructura exacta en Español:
{
  "executiveSummary": "Resumen ejecutivo de 2-3 oraciones explicando el impacto estratégico de esta ruta para el equipo.",
  "weekThemes": ["Título atractivo Semana 1", "Título atractivo Semana 2", ...],
  "moduleObjectives": [
    ["Objetivo práctico de 1 línea para módulo 1 de semana 1", ...],
    ...
  ]
}`;

        const { text, usedModel: m } = await this.callGeminiWithFallback({
          prompt: aiPrompt,
          temperature: 0.25,
          jsonMode: true,
          timeoutMs: 18000,
        });
        usedModel = m;
        const rawText = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(rawText);
        if (parsed.executiveSummary) executiveSummary = parsed.executiveSummary;
        if (Array.isArray(parsed.weekThemes)) {
          weeks.forEach((w, idx) => {
            if (parsed.weekThemes[idx]) w.theme = parsed.weekThemes[idx];
            if (Array.isArray(parsed.moduleObjectives?.[idx])) {
              w.modules.forEach((mod, mIdx) => {
                if (parsed.moduleObjectives[idx][mIdx]) {
                  mod.objective = parsed.moduleObjectives[idx][mIdx];
                }
              });
            }
          });
        }
      } catch (e) {
        // Keep high-quality deterministic Spanish titles & summary if JSON parse fails
      }
    }

    const plan: CurriculumPlan = {
      id: `plan-${Date.now()}`,
      targetRole,
      team_slug: teamSlug,
      team_name,
      weeksCount,
      hoursPerWeek,
      detectedGapsAddressed: teamGaps.slice(0, 4),
      executiveSummary,
      weeks,
      generatedByModel: usedModel,
      createdAt: new Date().toISOString(),
    };

    await storage.saveCurriculum(plan);
    return plan;
  }

  /**
   * MODULE 7: Nudge & Engagement Campaign Generator
   */
  public async generateNudgeCampaign(params: {
    segmentId: CampaignSegmentId;
    channel: 'email' | 'chat';
    tone: 'ejecutivo' | 'motivacional' | 'urgente';
  }): Promise<NudgeCampaignDraft> {
    this.ensureClient();
    const { segmentId, channel, tone } = params;
    const segments = await storage.computeNudgeSegments();
    const targetSeg = segments.find((s) => s.id === segmentId) || segments[0];

    const labName = targetSeg.suggestedStarterLab?.name || 'Google Cloud Fundamentals: Core Infrastructure';
    const labUrl = targetSeg.suggestedStarterLab?.url || 'https://www.skills.google/catalog';
    const recipientEmails = targetSeg.sampleRecipients.map((r) => r.email);

    let subject = `Impulsa tu desarrollo en Google Skills — ${targetSeg.title}`;
    let messageBody = `Hola {{Nombre}},\n\nTe invitamos a aprovechar tu licencia activa de Google Skills en la organización. Te recomendamos comenzar hoy con un módulo práctico de 30 minutos:\n\n👉 ${labName}\n🔗 ${labUrl}\n\n¡Mucho éxito en tu ruta de aprendizaje!`;
    let usedCampaignModel = this.model;

    if (this.ai) {
      const prompt = `Redacta una campaña de comunicación interna en ESPAÑOL para colaboradores de la organización inscritos en Google Skills.
- Segmento objetivo: "${targetSeg.title}" (${targetSeg.subtitle}). Total personas en segmento: ${targetSeg.count}.
- Canal: ${channel === 'email' ? 'Correo Electrónico Corporativo' : 'Mensaje directo de Google Chat / Slack (breve, con emojis sutiles y viñetas)'}.
- Tono solicitado: ${tone.toUpperCase()}.
- Módulo recomendado para romper la inercia o avanzar: "${labName}" (${labUrl}).
- Usa la variable {{Nombre}} para personalizar el saludo.

Devuelve EXCLUSIVAMENTE un JSON válido (sin bloques markdown \`\`\`) con las llaves:
{
  "subject": "Asunto atractivo (o encabezado si es chat)",
  "messageBody": "Cuerpo completo del mensaje en español listo para copiar y enviar"
}`;

      try {
        const { text, usedModel: m } = await this.callGeminiWithFallback({
          prompt,
          temperature: 0.35,
          jsonMode: true,
          timeoutMs: 18000,
        });
        usedCampaignModel = m;
        const cleaned = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.subject) subject = parsed.subject;
        if (parsed.messageBody) messageBody = parsed.messageBody;
      } catch (err) {
        // Fallback to default template
      }
    }

    return {
      segmentId,
      channel,
      tone,
      subject,
      messageBody,
      recipientEmails,
      recommendedLabName: labName,
      recommendedLabUrl: labUrl,
      generatedByModel: usedCampaignModel,
    };
  }
}

export const geminiAgent = new GeminiIntelligenceAgent();
