import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';

// Load .env
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
} catch (e) {
  console.warn('Could not load .env file:', e);
}

import crypto from 'crypto';
import { storage } from './src/lib/storage';
import { syncService } from './src/lib/sync-service';
import { geminiAgent } from './src/lib/gemini-agent';

async function startServer() {
  await storage.init();

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Cloud Run / Kubernetes liveness & readiness probe (always unauthenticated)
  app.get('/healthz', async (_req, res) => {
    try {
      const rt = storage.getRuntimeInfo();
      const status = await storage.getSyncStatus();
      res.status(200).json({
        ok: true,
        runtimeEnv: rt.runtimeEnv,
        storageBackend: rt.storageBackend,
        gcsBucket: rt.gcsBucket || null,
        bqDataset:
          rt.storageBackend === 'bigquery' && rt.bqProjectId
            ? `${rt.bqProjectId}.${rt.bqDatasetId}`
            : null,
        geminiAuthMode: geminiAgent.getAuthMode(),
        activities: status?.counts?.activities || 0,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Cloud Run Sync Job webhook to invalidate & reload RAM cache across instances
  app.post('/api/cron/refresh-cache', express.json(), async (req, res) => {
    try {
      const expectedToken = (process.env.CRON_REFRESH_TOKEN || '').trim();
      if (expectedToken) {
        const provided = String(req.headers['x-cron-token'] || '');
        const a = Buffer.from(provided);
        const b = Buffer.from(expectedToken);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          return res.status(401).json({ ok: false, error: 'Token de refresco inválido' });
        }
      }
      const refreshed = await storage.refreshFromCloudIfNeeded(true);
      const status = await storage.getSyncStatus();
      return res.json({ ok: true, refreshed, counts: status.counts });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Optional HTTP Basic Auth guard when DASHBOARD_ACCESS_PASSWORD is set (useful on Cloud Run without IAP)
  const accessPassword = (process.env.DASHBOARD_ACCESS_PASSWORD || '').trim();
  if (accessPassword) {
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Basic ')) {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const colonIdx = decoded.indexOf(':');
        const providedPass = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
        const a = Buffer.from(providedPass);
        const b = Buffer.from(accessPassword);
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          return next();
        }
      }
      res.setHeader('WWW-Authenticate', 'Basic realm="Google Skills for Organizations v1.1"');
      return res.status(401).send('Autenticación requerida para acceder al tablero.');
    });
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ==========================================
  // API ROUTES
  // ==========================================

  // Status and connectivity
  app.get('/api/status', async (_req, res) => {
    try {
      await storage.refreshFromCloudIfNeeded(false);
      const status = await storage.getSyncStatus();
      const apiCfg = storage.getApiConfig();
      const rt = storage.getRuntimeInfo();
      res.json({
        ok: true,
        status,
        isSyncing: syncService.isSyncing(),
        orgStats: storage.getOrgStats() || null,
        contractedLicenses: apiCfg.contractedLicenses || 500,
        geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        hasSkillsCredentials: Boolean(
          apiCfg.accessKey &&
          apiCfg.secretKey &&
          apiCfg.organizationSlug
        ),
        organizationSlug: apiCfg.organizationSlug || '',
        runtime: {
          env: rt.runtimeEnv,
          storageBackend: rt.storageBackend,
          gcsBucket: rt.gcsBucket || null,
          bqDataset:
            rt.storageBackend === 'bigquery' && rt.bqProjectId
              ? `${rt.bqProjectId}.${rt.bqDatasetId}`
              : null,
          geminiAuthMode: geminiAgent.getAuthMode(),
          isCloudRun: rt.isCloudRun,
          lockSettings: rt.lockSettingsInCloud,
        },
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Settings Management (Secret Key is always masked on read)
  app.get('/api/settings', async (_req, res) => {
    try {
      const config = storage.getMaskedApiConfig();
      res.json({ ok: true, config });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/settings', async (req, res) => {
    try {
      let { accessKey, secretKey, organizationSlug, baseUrl, contractedLicenses } = req.body || {};
      const rt = storage.getRuntimeInfo();
      const currentCfg = storage.getApiConfig();

      const parsedLicenses =
        contractedLicenses !== undefined && Number(contractedLicenses) > 0
          ? Math.round(Number(contractedLicenses))
          : undefined;

      // In locked Cloud mode, Secret Manager owns API keys; only allow updating contractedLicenses
      if (rt.lockSettingsInCloud) {
        storage.saveApiConfig({
          ...(parsedLicenses ? { contractedLicenses: parsedLicenses } : {}),
        });
        await storage.flushCloudPersist();
        return res.json({ ok: true, config: storage.getMaskedApiConfig() });
      }

      if (organizationSlug) {
        const urlMatch = organizationSlug.match(/organization\/([^/]+)/);
        if (urlMatch) {
          organizationSlug = urlMatch[1];
        }
        organizationSlug = organizationSlug.trim().replace(/^\/+|\/+$/g, '');
      }

      const trimmedSecret = typeof secretKey === 'string' ? secretKey.trim() : '';
      const isMaskedSecret = trimmedSecret.startsWith('••••') || trimmedSecret === '';
      const resolvedSecret = isMaskedSecret ? currentCfg.secretKey : trimmedSecret;

      storage.saveApiConfig({
        accessKey: accessKey !== undefined ? accessKey.trim() : currentCfg.accessKey,
        secretKey: resolvedSecret,
        organizationSlug:
          organizationSlug !== undefined ? organizationSlug.trim() : currentCfg.organizationSlug,
        baseUrl: baseUrl?.trim() || currentCfg.baseUrl || 'https://www.skills.google/api/v2',
        ...(parsedLicenses ? { contractedLicenses: parsedLicenses } : {}),
      });
      await storage.flushCloudPersist();
      res.json({ ok: true, config: storage.getMaskedApiConfig() });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/settings/test', async (req, res) => {
    try {
      let { accessKey, secretKey, organizationSlug, baseUrl } = req.body || {};
      const currentCfg = storage.getApiConfig();

      if (organizationSlug) {
        const urlMatch = organizationSlug.match(/organization\/([^/]+)/);
        if (urlMatch) {
          organizationSlug = urlMatch[1];
        }
        organizationSlug = organizationSlug.trim().replace(/^\/+|\/+$/g, '');
      } else {
        organizationSlug = currentCfg.organizationSlug;
      }

      const trimmedSecret = typeof secretKey === 'string' ? secretKey.trim() : '';
      const resolvedSecret =
        !trimmedSecret || trimmedSecret.startsWith('••••') ? currentCfg.secretKey : trimmedSecret;
      const resolvedAccessKey = (accessKey || '').trim() || currentCfg.accessKey;

      const { SkillsApiClient } = await import('./src/lib/skills-client');
      const testClient = new SkillsApiClient({
        accessKey: resolvedAccessKey,
        secretKey: resolvedSecret,
        organizationSlug,
        baseUrl: (baseUrl || '').trim() || currentCfg.baseUrl,
      });

      await testClient.getAuthToken(true);
      let catalogTested = false;
      let itemCount = 0;

      if (organizationSlug) {
        try {
          const items = await testClient.fetchLearningCatalog(1, 5);
          catalogTested = true;
          itemCount = items.length;
        } catch (catErr: any) {
          return res.json({
            ok: false,
            authenticated: true,
            error: `La autenticación fue exitosa, pero la solicitud de catálogo para el slug '${organizationSlug}' falló: ${catErr.message}. Verifica el slug de la organización.`,
          });
        }
      }

      res.json({
        ok: true,
        authenticated: true,
        catalogTested,
        itemCount,
        message: catalogTested
          ? `¡Conexión verificada! Conectado exitosamente a la API de Google Skills y catálogo recuperado para '${organizationSlug}'.`
          : `¡Autenticación exitosa! La Clave de Acceso y la Clave Secreta están activas. Ingresa el slug de la organización para obtener sus datos.`,
      });
    } catch (err: any) {
      res.json({ ok: false, error: err.message });
    }
  });

  // Trigger sync (Live async background worker or immediate Demo toggle)
  app.post('/api/sync', async (req, res) => {
    try {
      const { forceDemo, startDate, endDate } = req.body || {};
      const apiCfg = storage.getApiConfig();
      const canRunLive = Boolean(
        !forceDemo && apiCfg.accessKey && apiCfg.secretKey && apiCfg.organizationSlug
      );

      if (!canRunLive) {
        const status = await syncService.sync({ forceDemo: true });
        return res.json({ ok: true, async: false, status });
      }

      if (syncService.isSyncing()) {
        const status = await storage.getSyncStatus();
        return res.json({ ok: true, async: true, status });
      }

      const initialStatus = await storage.updateSyncStatus({
        status: 'syncing',
        message:
          'Iniciando sincronización histórica completa con Google Skills API v2 (puede tardar de 2 a 5 minutos)...',
      });

      // Run in background so large enterprise org reports do not hit HTTP request timeouts
      syncService
        .sync({ forceDemo: false, startDate, endDate })
        .catch((err) => console.error('Background sync error:', err));

      res.json({ ok: true, async: true, status: initialStatus });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Catalog
  app.get('/api/catalog', async (req, res) => {
    try {
      const catalog = await storage.getCatalog();
      res.json({ ok: true, catalog });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Module 1: Overall Dashboard Stats
  app.get('/api/analytics/overall', async (req, res) => {
    try {
      const stats = await storage.computeOverallStats();
      res.json({ ok: true, stats });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Module 2: Team Analytics
  app.get('/api/analytics/teams', async (req, res) => {
    try {
      const teamSlug = req.query.slug as string | undefined;
      const teams = await storage.computeTeamStats(teamSlug);
      res.json({ ok: true, teams });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Members list
  app.get('/api/analytics/members', async (req, res) => {
    try {
      const members = await storage.getMembers();
      res.json({ ok: true, members });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Module 2 Drilldown: Individual Member
  app.get('/api/analytics/members/:email', async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const drilldown = await storage.computeMemberDrilldown(email);
      if (!drilldown) {
        return res.status(404).json({ ok: false, error: 'Estudiante no encontrado' });
      }
      res.json({ ok: true, member: drilldown });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Module 2 AI Profile Summary & Certification Readiness (Google Gemini)
  app.get('/api/analytics/members/:email/ai-summary', async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const forceRefresh = req.query.refresh === 'true';
      const summary = await geminiAgent.generateMemberSummary(email, forceRefresh);
      if (!summary) {
        return res.status(404).json({ ok: false, error: 'Estudiante no encontrado' });
      }
      res.json({ ok: true, summary });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 1: Adoption, Licenses & Retention (ROI)
  app.get('/api/analytics/adoption', async (req, res) => {
    try {
      const adoption = await storage.computeAdoptionStats();
      res.json({ ok: true, adoption });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 2: Skill Gap Matrix & Technical Maturity
  app.get('/api/analytics/skill-matrix', async (req, res) => {
    try {
      const matrix = await storage.computeSkillMatrix();
      res.json({ ok: true, matrix });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 3: Learning Paths & Certification Readiness
  app.get('/api/analytics/certifications', async (req, res) => {
    try {
      const certifications = await storage.computeCertificationStats();
      res.json({ ok: true, certifications });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 4: Executive Team Benchmarking
  app.get('/api/analytics/benchmarking', async (req, res) => {
    try {
      const benchmarking = await storage.computeBenchmarkingStats();
      res.json({ ok: true, benchmarking });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 5: Quarterly Goals / OKRs CRUD & Progress
  app.get('/api/goals', async (req, res) => {
    try {
      const progress = await storage.computeGoalsProgress();
      res.json({ ok: true, ...progress });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/goals', async (req, res) => {
    try {
      const body = req.body || {};
      const goal = {
        id: body.id || `okr-${Date.now()}`,
        team_slug: body.team_slug || 'org-all',
        title: (body.title || 'Nueva Meta Trimestral').trim(),
        targetHoursPerMember: Number(body.targetHoursPerMember) || 5,
        targetAdoptionRate: Number(body.targetAdoptionRate) || 60,
        targetCategory: body.targetCategory || undefined,
        targetCategoryCompletions: body.targetCategoryCompletions ? Number(body.targetCategoryCompletions) : undefined,
        quarterLabel: (body.quarterLabel || 'Q4 2026').trim(),
      };
      await storage.upsertGoal(goal);
      const progress = await storage.computeGoalsProgress();
      res.json({ ok: true, ...progress });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.delete('/api/goals/:id', async (req, res) => {
    try {
      await storage.deleteGoal(req.params.id);
      const progress = await storage.computeGoalsProgress();
      res.json({ ok: true, ...progress });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Executive CSV Data Export (Activities or Roster Adoption)
  app.get('/api/export/csv', async (req, res) => {
    try {
      const type = (req.query.type as string) || 'activities';
      const escapeCsv = (val: unknown) => {
        const str = val === null || val === undefined ? '' : String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Spanish accents
      let filename = `reporte-skills-${type}.csv`;

      if (type === 'adoption') {
        const adoption = await storage.computeAdoptionStats();
        csvContent += [
          'Nombre',
          'Correo Electronico',
          'Equipo',
          'Estado Invitacion',
          'Estado Uso',
          'Actividades Iniciadas',
          'Actividades Completadas',
          'Horas Invertidas',
          'Ultima Actividad',
          'Dias Sin Actividad',
        ].join(',') + '\n';

        for (const m of adoption.memberStatuses) {
          csvContent += [
            escapeCsv(m.name),
            escapeCsv(m.email),
            escapeCsv(m.team_name),
            escapeCsv(m.inviteStatus),
            escapeCsv(m.riskStatus),
            m.activitiesStarted,
            m.activitiesCompleted,
            m.hoursSpent,
            escapeCsv(m.lastActivityDate || 'Sin actividad'),
            m.daysSinceLastActivity ?? 'N/A',
          ].join(',') + '\n';
        }
        filename = 'reporte-adopcion-licencias.csv';
      } else {
        const activities = await storage.getActivities();
        csvContent += [
          'Estudiante',
          'Correo Electronico',
          'Equipo',
          'Actividad',
          'Tipo',
          'Categoria',
          'Ruta / Certificacion Padre',
          'Aprobado',
          'Calificacion',
          'Puntaje Maximo',
          'Minutos Invertidos',
          'Fecha Inicio',
          'Fecha Finalizacion',
        ].join(',') + '\n';

        for (const a of activities) {
          csvContent += [
            escapeCsv(a.memberName || a.Member),
            escapeCsv(a.Member),
            escapeCsv(a.team_name || 'Miembro de la Organización'),
            escapeCsv(a.Activity),
            escapeCsv(a['Activity Type']),
            escapeCsv(a.category || ''),
            escapeCsv(a['Parent Name'] || ''),
            a.Passed === 'true' ? 'Sí' : 'No',
            escapeCsv(a['Given Score']),
            escapeCsv(a['Maximum Score']),
            escapeCsv(a['Learning time (minutes)']),
            escapeCsv(a['Date started']),
            escapeCsv(a['Date completed']),
          ].join(',') + '\n';
        }
        filename = 'sabana-actividades-capacitacion.csv';
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Executive Monthly AI Summary Generator
  app.post('/api/ai/executive-report', async (req, res) => {
    try {
      const result = await geminiAgent.generateExecutiveReport();
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 6: AI Curriculum Builder
  app.get('/api/curricula', async (req, res) => {
    try {
      const curricula = await storage.getCurricula();
      res.json({ ok: true, curricula });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/ai/curriculum', async (req, res) => {
    try {
      const { teamSlug, targetRole, weeksCount, hoursPerWeek } = req.body || {};
      const plan = await geminiAgent.generateCurriculumPlan({
        teamSlug: teamSlug || 'org-all',
        targetRole: (targetRole || 'Arquitecto Cloud e IA Generativa').trim(),
        weeksCount: Math.min(12, Math.max(1, Number(weeksCount) || 4)),
        hoursPerWeek: Math.min(20, Math.max(1, Number(hoursPerWeek) || 3)),
      });
      const curricula = await storage.getCurricula();
      res.json({ ok: true, plan, curricula });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.delete('/api/curricula/:id', async (req, res) => {
    try {
      const curricula = await storage.deleteCurriculum(req.params.id);
      res.json({ ok: true, curricula });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 7: Nudge & Engagement Hub
  app.get('/api/campaigns/segments', async (req, res) => {
    try {
      const segments = await storage.computeNudgeSegments();
      res.json({ ok: true, segments });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/ai/nudge-campaign', async (req, res) => {
    try {
      const { segmentId, channel, tone } = req.body || {};
      const draft = await geminiAgent.generateNudgeCampaign({
        segmentId: segmentId || 'inactive_zero',
        channel: channel === 'chat' ? 'chat' : 'email',
        tone: tone || 'motivacional',
      });
      res.json({ ok: true, draft });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 8: Internal Talent Finder & SME Directory
  app.get('/api/analytics/talent', async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      const directory = await storage.searchInternalTalent(q);
      res.json({ ok: true, directory });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 9: Gamification & Enterprise Cloud League
  app.get('/api/analytics/gamification', async (req, res) => {
    try {
      const gamification = await storage.computeGamificationStats();
      res.json({ ok: true, gamification });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 10: Learning Pulse & Study Habits Heatmap
  app.get('/api/analytics/learning-pulse', async (req, res) => {
    try {
      const pulse = await storage.computeLearningPulse();
      res.json({ ok: true, pulse });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // NEW DASHBOARD 11: Financial Simulator Baseline
  app.get('/api/analytics/finance', async (req, res) => {
    try {
      const finance = await storage.computeFinanceBaseline();
      res.json({ ok: true, finance });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Module 3: Google Gemini Intelligence Engine
  app.post('/api/ai/query', async (req, res) => {
    try {
      const { query, history } = req.body || {};
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ ok: false, error: 'Se requiere una consulta de texto' });
      }
      const response = await geminiAgent.query(query, history);
      res.json({ ok: true, ...response });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Interactive Manuals & Documentation Center API
  app.get('/api/manuals', (_req, res) => {
    try {
      const manualsDir = path.join(process.cwd(), 'docs', 'manuales');
      const catalogDefs = [
        {
          id: 'quickstart',
          title: 'Resumen General y Arquitectura',
          subtitle: 'Visión ejecutiva, arquitectura Cloud Run + BigQuery y comandos rápidos',
          badge: 'Inicio Rápido',
          filePath: path.join(process.cwd(), 'README.md'),
          filename: 'README.md',
        },
        {
          id: 'user-guide',
          title: '01 • Manual de Usuario Ejecutivo y LXP',
          subtitle: 'Guía funcional de los 15 módulos, interpretación de KPIs y reglas de negocio',
          badge: 'Usuarios y Líderes',
          filePath: path.join(manualsDir, '01-manual-usuario-ejecutivo-y-lxp.md'),
          filename: '01-manual-usuario-ejecutivo-y-lxp.md',
        },
        {
          id: 'admin-cloud',
          title: '02 • Manual de Administración y Cloud Run',
          subtitle: 'Operación diaria, Secret Manager, Cloud Run Jobs, respaldos y soporte',
          badge: 'TI / Operaciones',
          filePath: path.join(manualsDir, '02-manual-administrador-y-operacion-cloud.md'),
          filename: '02-manual-administrador-y-operacion-cloud.md',
        },
        {
          id: 'bigquery-bi',
          title: '03 • Diccionario BigQuery y Looker Studio',
          subtitle: 'Modelo estrella particionado, vistas SQL analíticas y conexión BI',
          badge: 'Datos y BI',
          filePath: path.join(manualsDir, '03-manual-datos-bigquery-y-looker.md'),
          filename: '03-manual-datos-bigquery-y-looker.md',
        },
        {
          id: 'terraform-iac',
          title: '04 • Manual de Terraform Interactivo',
          subtitle: 'Despliegue guiado paso a paso (deploy:wizard), módulos IaC y CI/CD',
          badge: 'DevOps / IaC',
          filePath: path.join(manualsDir, '04-manual-terraform-interactivo.md'),
          filename: '04-manual-terraform-interactivo.md',
        },
      ];

      const manuals = catalogDefs
        .filter((d) => fs.existsSync(d.filePath))
        .map((d) => ({
          id: d.id,
          title: d.title,
          subtitle: d.subtitle,
          badge: d.badge,
          filename: d.filename,
          content: fs.readFileSync(d.filePath, 'utf8'),
        }));

      res.json({ ok: true, manuals });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ==========================================
  // VITE OR STATIC FRONTEND SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/.data/**', '**/terraform/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const rt = storage.getRuntimeInfo();
  const server = app.listen(PORT, '0.0.0.0', () => {
    const storageDesc =
      rt.storageBackend === 'bigquery'
        ? `Google BigQuery (${rt.bqProjectId}.${rt.bqDatasetId})`
        : rt.storageBackend === 'gcs'
        ? `Google Cloud Storage (gs://${rt.gcsBucket}/${rt.gcsObject})`
        : `Disco Local (${rt.localStoreFile})`;
    const aiDesc =
      geminiAgent.getAuthMode() === 'vertex_ai'
        ? `Vertex AI ADC (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})`
        : `Gemini API (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})`;
    console.log(`\n======================================================`);
    console.log(`🚀 Google Skills for Organizations v1.1 activo en: http://localhost:${PORT}`);
    console.log(`🌐 Entorno de Ejecución: ${rt.runtimeEnv === 'cloud' ? 'Google Cloud (Cloud Run)' : 'Modo Local'}`);
    console.log(`💾 Persistencia de Datos: ${storageDesc}`);
    console.log(`🤖 Módulo de Inteligencia: ${aiDesc}`);
    console.log(`📊 Fuente: ${storage.getApiConfig().accessKey ? 'API de Google Skills en Vivo' : 'Datos de Demostración'}`);
    console.log(`======================================================\n`);
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Señal ${signal} recibida. Asegurando persistencia antes de cerrar...`);
    try {
      await storage.flushCloudPersist();
    } catch {
      // ignore
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 4000).unref();
  };

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
