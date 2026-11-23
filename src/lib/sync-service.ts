import { SkillsApiClient, formatNameFromEmail } from './skills-client';
import { storage, ORG_GENERAL_TEAM_SLUG, ORG_GENERAL_TEAM_NAME } from './storage';
import { SyncStatus, LearningActivity, OrganizationOfficialStats } from '../types';

export class SyncService {
  private client: SkillsApiClient;
  private syncing = false;

  constructor() {
    this.client = new SkillsApiClient();
  }

  public isSyncing(): boolean {
    return this.syncing;
  }

  public async sync(options: { forceDemo?: boolean; startDate?: string; endDate?: string } = {}): Promise<SyncStatus> {
    this.client.reloadConfig();

    if (options.forceDemo || !this.client.isConfigured()) {
      storage.resetToDemo();
      await storage.flushCloudPersist();
      return storage.getSyncStatus();
    }

    if (this.syncing) {
      return storage.getSyncStatus();
    }

    this.syncing = true;
    try {
      await storage.updateSyncStatus({
        status: 'syncing',
        message: 'Autenticando con la API de Google Skills para Organizaciones (v2)...',
      });

      // 1. Fetch Full Learning Catalog (paginated)
      await storage.updateSyncStatus({
        status: 'syncing',
        message: 'Obteniendo catálogo completo de cursos, rutas y laboratorios...',
      });
      const catalog = await this.client.fetchAllCatalogItems();
      await storage.saveCatalog(catalog);

      const catalogMap = new Map<string, string>();
      for (const item of catalog) {
        catalogMap.set(item.content_id, item.category);
      }

      // 2. Fetch All Teams & Members (paginated)
      await storage.updateSyncStatus({
        status: 'syncing',
        message: 'Obteniendo estructura de equipos e integrantes asignados...',
      });
      const rawTeams = await this.client.fetchAllTeams();
      const allMembers = [];
      const memberTeamMap = new Map<
        string,
        { team_slug: string; team_name: string; memberName: string }
      >();

      const enrichedTeams = [];
      for (const team of rawTeams) {
        let count = 0;
        try {
          const teamMembers = await this.client.fetchAllTeamMembers(team.slug);
          count = teamMembers.length;
          for (const m of teamMembers) {
            const fullName = `${m.first_name || ''} ${m.last_name || ''}`.trim();
            allMembers.push({
              ...m,
              team_slug: team.slug,
              team_name: team.name,
            });
            if (!memberTeamMap.has(m.email.toLowerCase())) {
              memberTeamMap.set(m.email.toLowerCase(), {
                team_slug: team.slug,
                team_name: team.name,
                memberName: fullName || formatNameFromEmail(m.email),
              });
            }
          }
        } catch (err) {
          console.warn(`Failed fetching members for team ${team.slug}:`, err);
        }
        enrichedTeams.push({
          ...team,
          member_count: count,
        });
      }

      await storage.saveTeams(enrichedTeams);
      await storage.saveMembers(allMembers);

      // 3. Determine All-Time Historical Window (default from 2020-01-01 to capture full history)
      const now = new Date();
      const startDate = options.startDate || '2020-01-01T00:00:00Z';
      const endDate = options.endDate || now.toISOString().split('.')[0] + 'Z';

      await storage.updateSyncStatus({
        status: 'syncing',
        message: 'Solicitando reporte histórico completo y estadísticas oficiales en Google Skills...',
      });

      // 4. Trigger Official Organization Stats (/stats) + Full Learning Activities Report
      const orgStatsPromise = (async (): Promise<OrganizationOfficialStats | null> => {
        try {
          const statsOp = await this.client.triggerOrganizationStats({ startDate, endDate });
          const statsResult = await this.client.pollOperation(statsOp.operation_id, 300, 5000);
          if (statsResult) {
            const officialStats: OrganizationOfficialStats = {
              accepted_invitations: Number(statsResult.accepted_invitations) || 0,
              pending_invitations: Number(statsResult.pending_invitations) || 0,
              cumulative_learners: Number(statsResult.cumulative_learners) || 0,
              labs_started: Number(statsResult.labs_started) || 0,
              courses_enrolled: Number(statsResult.courses_enrolled) || 0,
              labs_passed: Number(statsResult.labs_passed) || 0,
              courses_completed: Number(statsResult.courses_completed) || 0,
              skills_badges_earned: Number(statsResult.skills_badges_earned) || 0,
              startDate,
              endDate,
              fetchedAt: new Date().toISOString(),
            };
            await storage.saveOrgStats(officialStats);
            return officialStats;
          }
        } catch (err) {
          console.warn('Could not retrieve /organizations/{slug}/stats:', err);
        }
        return null;
      })();

      const op = await this.client.triggerLearningActivitiesReport({
        startDate,
        endDate,
      });

      await storage.updateSyncStatus({
        status: 'syncing',
        message: `Generando reporte histórico completo en Google Skills (Operación #${op.operation_id})...`,
      });

      // Poll up to 25 minutes (300 * 5s) for enterprise organizations with 500+ licenses
      const opResult = await this.client.pollOperation(
        op.operation_id,
        300,
        5000,
        async (_attempt, elapsedSec) => {
          const mins = Math.floor(elapsedSec / 60);
          const secs = elapsedSec % 60;
          const timeLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
          await storage.updateSyncStatus({
            status: 'syncing',
            message: `Google Skills está compilando la sábana histórica de toda la organización (Operación #${op.operation_id} • ${timeLabel} transcurridos)...`,
          });
        }
      );

      const reportId = opResult?.report_id || opResult?.id;
      if (!reportId) {
        throw new Error(`La operación #${op.operation_id} finalizó sin devolver un report_id`);
      }

      await storage.updateSyncStatus({
        status: 'syncing',
        message: `Descargando y procesando reporte histórico #${reportId}...`,
      });

      const [report, officialStats] = await Promise.all([
        this.client.fetchReport(reportId),
        orgStatsPromise,
      ]);

      const rawActivities = report.report_data || [];

      // Enrich activities with catalog category, team info, and learner name
      const uniqueActiveEmails = new Set<string>();
      const enrichedActivities: LearningActivity[] = rawActivities.map((a: any, idx: number) => {
        const email = (a.Member || '').toLowerCase();
        if (email) uniqueActiveEmails.add(email);
        const teamInfo = memberTeamMap.get(email);
        const category =
          catalogMap.get(a['Content ID']) || this.client.classifyCategory(a.Activity || '', '');

        return {
          ...a,
          id: `act-live-${idx + 1}`,
          category,
          team_slug: teamInfo?.team_slug || ORG_GENERAL_TEAM_SLUG,
          team_name: teamInfo?.team_name || ORG_GENERAL_TEAM_NAME,
          memberName: teamInfo?.memberName || formatNameFromEmail(a.Member || ''),
        };
      });

      await storage.saveActivities(enrichedActivities);

      const contractedPool = storage.getApiConfig().contractedLicenses || 500;
      const seatsSummary = officialStats?.accepted_invitations
        ? `${contractedPool.toLocaleString()} licencias vigentes, ${officialStats.accepted_invitations.toLocaleString()} inv. aceptadas históricas, ${officialStats.skills_badges_earned.toLocaleString()} Skill Badges`
        : `${uniqueActiveEmails.size.toLocaleString()} colaboradores formados`;

      const finalStatus = await storage.updateSyncStatus({
        status: 'success',
        mode: 'live',
        lastSyncAt: new Date().toISOString(),
        message: `¡Sincronización histórica completada! ${enrichedActivities.length.toLocaleString()} actividades, ${uniqueActiveEmails.size.toLocaleString()} colaboradores formados (${seatsSummary}) y ${catalog.length.toLocaleString()} cursos en catálogo.`,
        counts: {
          catalog: catalog.length,
          teams: enrichedTeams.length,
          members: contractedPool,
          activities: enrichedActivities.length,
        },
      });
      await storage.flushCloudPersist();
      return finalStatus;
    } catch (error: any) {
      console.error('Sync failed:', error);
      const errStatus = await storage.updateSyncStatus({
        status: 'error',
        message: `Error de sincronización: ${error.message || String(error)}`,
      });
      await storage.flushCloudPersist();
      return errStatus;
    } finally {
      this.syncing = false;
    }
  }
}

export const syncService = new SyncService();


