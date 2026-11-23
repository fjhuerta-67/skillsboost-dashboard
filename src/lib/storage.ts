import fs from 'fs';
import {
  CatalogItem,
  Team,
  Member,
  LearningActivity,
  OverallStats,
  TeamStats,
  MemberDrilldown,
  AdoptionStats,
  SkillMatrixStats,
  CertificationStats,
  BenchmarkingStats,
  TeamGoalConfig,
  GoalsAndOkrsResponse,
  CurriculumPlan,
  NudgeSegmentSummary,
  TalentDirectoryResponse,
  TalentExpert,
  GamificationStats,
  LearningPulseStats,
  FinanceBaselineStats,
  OrganizationOfficialStats,
  SyncStatus,
  ApiConfig,
} from '../types';
import { MOCK_CATALOG, MOCK_TEAMS, MOCK_MEMBERS, generateMockActivities } from './mock-data';
import { formatNameFromEmail } from './skills-client';
import {
  getRuntimeStorageConfig,
  downloadGcsStore,
  uploadGcsStore,
  RuntimeStorageConfig,
} from './gcs-adapter';
import {
  loadSnapshotFromBigQuery,
  persistSnapshotToBigQuery,
  upsertGoalInBigQuery,
  deleteGoalInBigQuery,
  upsertCurriculumInBigQuery,
  deleteCurriculumInBigQuery,
  fetchLatestBigQuerySyncMarker,
} from './bigquery-adapter';

const CORE_CATEGORIES = [
  'Cloud Infrastructure',
  'Data & Analytics',
  'AI & Machine Learning',
  'Cloud Security & IAM',
  'Containers & Kubernetes',
  'DevOps & SRE',
];

export const ORG_GENERAL_TEAM_SLUG = 'organizacion-general';
export const ORG_GENERAL_TEAM_NAME = 'Organización General (Sin Equipo)';

interface DatabaseSchema {
  apiConfig: ApiConfig;
  orgStats?: OrganizationOfficialStats;
  catalog: CatalogItem[];
  teams: Team[];
  members: Member[];
  activities: LearningActivity[];
  goals?: TeamGoalConfig[];
  curricula?: CurriculumPlan[];
  syncStatus: SyncStatus;
}

interface IndexedContext {
  memberByEmail: Map<string, Member>;
  memberTeamSlugs: Map<string, Set<string>>;
  teamNameBySlug: Map<string, string>;
  uniqueSubteamEmails: Set<string>;
  activitiesByEmail: Map<string, LearningActivity[]>;
  activitiesByTeamSlug: Map<string, LearningActivity[]>;
  catalogById: Map<string, CatalogItem>;
}

/**
 * In Google Skills API v2:
 * - Course / Path / Game / Certification finished => Passed === 'true' (and Date completed set)
 * - Lab passed => Passed === 'true' (whereas abandoned/failed labs have Date completed set and Passed === 'false')
 */
function isSuccessfulCompletion(a: LearningActivity): boolean {
  if (a.Passed === 'true') return true;
  // Fallback only if Passed field is missing in custom records
  if (a.Passed === undefined && Boolean(a['Date completed'])) return true;
  return false;
}

class StorageService {
  private inMemoryData: DatabaseSchema | null = null;
  private indexedContext: IndexedContext | null = null;
  private analyticsCache: Map<string, any> = new Map();
  private cloudPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private cloudPersistPromise: Promise<void> | null = null;
  private lastBqSyncMarker: string | null = null;
  private lastBqCheckMs = 0;
  private initialized = false;

  constructor() {
    const cfg = getRuntimeStorageConfig();
    if (cfg.storageBackend === 'local') {
      this.ensureInitialized(true);
    }
  }

  public getRuntimeInfo(): RuntimeStorageConfig {
    return getRuntimeStorageConfig();
  }

  private buildDefaultApiConfig(): ApiConfig {
    return {
      baseUrl: process.env.SKILLS_API_BASE_URL || 'https://www.skills.google/api/v2',
      accessKey: process.env.SKILLS_ACCESS_KEY || '',
      secretKey: process.env.SKILLS_SECRET_KEY || '',
      organizationSlug: process.env.SKILLS_ORGANIZATION_SLUG || '',
      contractedLicenses: Number(process.env.SKILLS_CONTRACTED_LICENSES) || 500,
    };
  }

  private normalizeLoadedData(parsed: DatabaseSchema): DatabaseSchema {
    const defaults = this.buildDefaultApiConfig();
    if (!parsed.apiConfig) {
      parsed.apiConfig = defaults;
    } else {
      parsed.apiConfig = {
        baseUrl: parsed.apiConfig.baseUrl || defaults.baseUrl,
        accessKey: parsed.apiConfig.accessKey || defaults.accessKey,
        secretKey: parsed.apiConfig.secretKey || defaults.secretKey,
        organizationSlug: parsed.apiConfig.organizationSlug || defaults.organizationSlug,
        contractedLicenses: parsed.apiConfig.contractedLicenses || defaults.contractedLicenses || 500,
      };
    }
    if (!parsed.goals || !Array.isArray(parsed.goals) || parsed.goals.length === 0) {
      parsed.goals = this.defaultGoals(parsed.teams || []);
    }
    if (!Array.isArray(parsed.catalog)) parsed.catalog = [];
    if (!Array.isArray(parsed.teams)) parsed.teams = [];
    if (!Array.isArray(parsed.members)) parsed.members = [];
    if (!Array.isArray(parsed.activities)) parsed.activities = [];
    return parsed;
  }

  /**
   * Async startup initializer: hydrates RAM from BigQuery or Google Cloud Storage in cloud mode,
   * or from local .data/store.json in local mode.
   */
  public async init(): Promise<void> {
    if (this.initialized && this.inMemoryData) return;
    const cfg = getRuntimeStorageConfig();

    if (cfg.storageBackend === 'bigquery' && cfg.bqProjectId) {
      try {
        console.log(
          `📊 [Storage] Inicializando modo BigQuery Data Warehouse desde ${cfg.bqProjectId}.${cfg.bqDatasetId}...`
        );
        const bqLoaded = await loadSnapshotFromBigQuery();
        if (bqLoaded) {
          this.inMemoryData = this.normalizeLoadedData(bqLoaded.snapshot);
          this.lastBqSyncMarker = bqLoaded.syncMarker;
          this.lastBqCheckMs = Date.now();
          this.invalidateCache();
          this.initialized = true;
          console.log(
            `✅ [Storage] Almacén hidratado desde BigQuery (${this.inMemoryData.activities.length.toLocaleString()} actividades en RAM).`
          );
          return;
        }

        // First boot on empty BigQuery dataset: optionally migrate from GCS snapshot if configured, else seed initial data
        if (cfg.gcsBucket) {
          const gcsSeed = await downloadGcsStore<DatabaseSchema>(cfg.gcsBucket, cfg.gcsObject).catch(
            () => null
          );
          if (gcsSeed) {
            console.log(
              `☁️ [Storage] Migrando semilla inicial desde gs://${cfg.gcsBucket}/${cfg.gcsObject} hacia BigQuery...`
            );
            this.inMemoryData = this.normalizeLoadedData(gcsSeed);
            this.invalidateCache();
            this.initialized = true;
            await this.flushCloudPersist();
            return;
          }
        }

        console.log(
          `ℹ️ [Storage] Dataset ${cfg.bqProjectId}.${cfg.bqDatasetId} vacío. Inicializando estructura y semilla base en BigQuery...`
        );
        this.ensureInitialized(false);
        this.initialized = true;
        await this.flushCloudPersist();
        return;
      } catch (err) {
        console.error(
          '⚠️ [Storage] Error al conectar con BigQuery, respaldando en almacenamiento secundario/memoria:',
          err
        );
      }
    }

    if (cfg.storageBackend === 'gcs' && cfg.gcsBucket) {
      try {
        console.log(
          `☁️ [Storage] Inicializando modo Cloud desde gs://${cfg.gcsBucket}/${cfg.gcsObject}...`
        );
        const cloudStore = await downloadGcsStore<DatabaseSchema>(cfg.gcsBucket, cfg.gcsObject);
        if (cloudStore) {
          this.inMemoryData = this.normalizeLoadedData(cloudStore);
          this.invalidateCache();
          this.initialized = true;
          console.log(
            `✅ [Storage] Almacén hidratado desde GCS (${this.inMemoryData.activities.length.toLocaleString()} actividades en RAM).`
          );
          return;
        }
        console.log(
          `ℹ️ [Storage] No existe aún gs://${cfg.gcsBucket}/${cfg.gcsObject}. Se cargará semilla inicial y se creará el objeto en GCS.`
        );
        this.ensureInitialized(false);
        this.initialized = true;
        await this.flushCloudPersist();
        return;
      } catch (err) {
        console.error(
          '⚠️ [Storage] Error al leer desde Google Cloud Storage, respaldando en almacenamiento local/memoria:',
          err
        );
      }
    }

    this.ensureInitialized(true);
    this.initialized = true;
    console.log(
      `💾 [Storage] Modo Local activo en ${cfg.localStoreFile} (${
        this.inMemoryData?.activities.length.toLocaleString() || 0
      } actividades).`
    );
  }

  /**
   * Checks whether a newer background Cloud Run Job sync landed in BigQuery (or forces cache reload)
   */
  public async refreshFromCloudIfNeeded(force = false): Promise<boolean> {
    const cfg = getRuntimeStorageConfig();
    const now = Date.now();
    const ttlMs = Number(process.env.BQ_CACHE_TTL_MS) || 5 * 60 * 1000;

    if (cfg.storageBackend === 'bigquery' && cfg.bqProjectId) {
      if (!force && now - this.lastBqCheckMs < ttlMs) {
        return false;
      }
      this.lastBqCheckMs = now;
      try {
        if (!force) {
          const marker = await fetchLatestBigQuerySyncMarker();
          if (!marker || marker.syncId === this.lastBqSyncMarker) {
            return false;
          }
        }
        const bqLoaded = await loadSnapshotFromBigQuery();
        if (bqLoaded) {
          this.inMemoryData = this.normalizeLoadedData(bqLoaded.snapshot);
          this.lastBqSyncMarker = bqLoaded.syncMarker;
          this.invalidateCache();
          console.log(
            `🔄 [Storage] Caché en RAM actualizada desde BigQuery (${this.inMemoryData.activities.length.toLocaleString()} actividades).`
          );
          return true;
        }
      } catch (err) {
        console.warn('⚠️ [Storage] No se pudo refrescar caché desde BigQuery:', err);
      }
      return false;
    }

    if (force && cfg.storageBackend === 'gcs' && cfg.gcsBucket) {
      const cloudStore = await downloadGcsStore<DatabaseSchema>(cfg.gcsBucket, cfg.gcsObject);
      if (cloudStore) {
        this.inMemoryData = this.normalizeLoadedData(cloudStore);
        this.invalidateCache();
        return true;
      }
    }

    return false;
  }

  private invalidateCache() {
    this.indexedContext = null;
    this.analyticsCache.clear();
  }

  private defaultGoals(teams: Team[]): TeamGoalConfig[] {
    const defaults: TeamGoalConfig[] = [
      {
        id: 'okr-org-q4',
        team_slug: 'org-all',
        title: 'Meta Organizacional: Adopción Activa y Horas Cloud',
        targetHoursPerMember: 6,
        targetAdoptionRate: 60,
        targetCategory: 'AI & Machine Learning',
        targetCategoryCompletions: 250,
        quarterLabel: 'Q4 2026',
      },
    ];

    if (teams.length > 0) {
      const firstTeam = teams[0];
      defaults.push({
        id: `okr-${firstTeam.slug}`,
        team_slug: firstTeam.slug,
        title: `Aceleración Técnica — ${firstTeam.name}`,
        targetHoursPerMember: 12,
        targetAdoptionRate: 75,
        targetCategory: 'Cloud Infrastructure',
        targetCategoryCompletions: 25,
        quarterLabel: 'Q4 2026',
      });
    }

    if (teams.length > 1) {
      const secondTeam =
        teams.find((t) => t.slug !== defaults[1]?.team_slug) ||
        teams[1];
      defaults.push({
        id: `okr-${secondTeam.slug}`,
        team_slug: secondTeam.slug,
        title: `Fundamentos Cloud & GenAI — ${secondTeam.name}`,
        targetHoursPerMember: 5,
        targetAdoptionRate: 50,
        targetCategory: 'Data & Analytics',
        targetCategoryCompletions: 15,
        quarterLabel: 'Q4 2026',
      });
    }

    return defaults;
  }

  private ensureInitialized(allowLocalDisk = true) {
    const cfg = getRuntimeStorageConfig();

    if (allowLocalDisk) {
      if (!fs.existsSync(cfg.dataDir)) {
        try {
          fs.mkdirSync(cfg.dataDir, { recursive: true });
        } catch {
          // Fallback for read-only container filesystems
        }
      }

      if (fs.existsSync(cfg.localStoreFile)) {
        try {
          const raw = fs.readFileSync(cfg.localStoreFile, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed) {
            this.inMemoryData = this.normalizeLoadedData(parsed);
            this.invalidateCache();
            return;
          }
        } catch (err) {
          console.warn('Failed to parse existing store.json, re-initializing with seed data', err);
        }
      }
    }

    const mockActivities = generateMockActivities();
    const seededTeams = MOCK_TEAMS.map((t) => ({
      ...t,
      member_count: MOCK_MEMBERS.filter((m) => m.team_slug === t.slug).length,
    }));
    this.inMemoryData = {
      apiConfig: this.buildDefaultApiConfig(),
      catalog: MOCK_CATALOG,
      teams: seededTeams,
      members: MOCK_MEMBERS,
      activities: mockActivities,
      goals: this.defaultGoals(seededTeams),
      syncStatus: {
        lastSyncAt: new Date().toISOString(),
        mode: 'demo',
        status: 'success',
        message: 'Conjunto de datos de demostración cargado',
        counts: {
          catalog: MOCK_CATALOG.length,
          teams: MOCK_TEAMS.length,
          members: MOCK_MEMBERS.length,
          activities: mockActivities.length,
        },
      },
    };

    if (allowLocalDisk) {
      this.persist();
    }
  }

  private scheduleCloudPersist() {
    if (this.cloudPersistTimer) {
      clearTimeout(this.cloudPersistTimer);
    }
    this.cloudPersistTimer = setTimeout(() => {
      this.cloudPersistTimer = null;
      void this.flushCloudPersist();
    }, 500);
  }

  public async flushCloudPersist(): Promise<void> {
    const cfg = getRuntimeStorageConfig();
    if (!this.inMemoryData) return;

    if (this.cloudPersistTimer) {
      clearTimeout(this.cloudPersistTimer);
      this.cloudPersistTimer = null;
    }

    const snapshot = this.inMemoryData;

    if (cfg.storageBackend === 'bigquery' && cfg.bqProjectId) {
      this.cloudPersistPromise = (async () => {
        try {
          const { activitiesStored, syncId } = await persistSnapshotToBigQuery(snapshot);
          this.lastBqSyncMarker = syncId;
          this.lastBqCheckMs = Date.now();
          console.log(
            `📊 [Storage] Almacén persistido en BigQuery ${cfg.bqProjectId}.${cfg.bqDatasetId} (${activitiesStored.toLocaleString()} actividades • ${syncId})`
          );
          if (cfg.gcsBucket) {
            await uploadGcsStore(cfg.gcsBucket, cfg.gcsObject, snapshot);
          }
        } catch (err) {
          console.error('⚠️ [Storage] Error al persistir en BigQuery:', err);
        }
      })();
      await this.cloudPersistPromise;
      return;
    }

    if (cfg.storageBackend !== 'gcs' || !cfg.gcsBucket) return;

    this.cloudPersistPromise = uploadGcsStore(cfg.gcsBucket, cfg.gcsObject, snapshot)
      .then(({ bytesCompressed }) => {
        console.log(
          `☁️ [Storage] Guardado en gs://${cfg.gcsBucket}/${cfg.gcsObject} (${(
            bytesCompressed /
            (1024 * 1024)
          ).toFixed(2)} MB comprimidos)`
        );
      })
      .catch((err) => {
        console.error('⚠️ [Storage] Error al persistir en Google Cloud Storage:', err);
      });
    await this.cloudPersistPromise;
  }

  private persist() {
    this.invalidateCache();
    if (!this.inMemoryData) return;
    const cfg = getRuntimeStorageConfig();

    if (cfg.storageBackend === 'bigquery' && cfg.bqProjectId) {
      // Full snapshots flush via explicit flushCloudPersist() after sync/config updates;
      // granular OKR and Curricula mutations execute targeted BigQuery DML directly.
      return;
    }

    if (cfg.storageBackend === 'gcs' && cfg.gcsBucket) {
      this.scheduleCloudPersist();
      return;
    }

    try {
      if (!fs.existsSync(cfg.dataDir)) {
        fs.mkdirSync(cfg.dataDir, { recursive: true });
      }
      // Compact serialization when dataset is large (>2,000 activities) for fast disk I/O
      const isLarge = (this.inMemoryData.activities?.length || 0) > 2000;
      const serialized = isLarge
        ? JSON.stringify(this.inMemoryData)
        : JSON.stringify(this.inMemoryData, null, 2);
      fs.writeFileSync(cfg.localStoreFile, serialized, 'utf8');
    } catch (e) {
      console.warn('Could not persist store to disk, keeping in memory', e);
    }
  }

  public getData(): DatabaseSchema {
    if (!this.inMemoryData) {
      const cfg = getRuntimeStorageConfig();
      this.ensureInitialized(cfg.storageBackend === 'local');
    }
    return this.inMemoryData!;
  }

  /**
   * Builds O(1) lookup maps in a single linear pass over members, catalog, and activities
   */
  private getIndex(): IndexedContext {
    if (this.indexedContext) return this.indexedContext;

    const data = this.getData();
    const teamNameBySlug = new Map<string, string>();
    for (const t of data.teams) {
      teamNameBySlug.set(t.slug, t.name);
    }
    teamNameBySlug.set(ORG_GENERAL_TEAM_SLUG, ORG_GENERAL_TEAM_NAME);

    const memberByEmail = new Map<string, Member>();
    const memberTeamSlugs = new Map<string, Set<string>>();
    const uniqueSubteamEmails = new Set<string>();

    for (const m of data.members) {
      if (!m.email) continue;
      const lower = m.email.toLowerCase();
      uniqueSubteamEmails.add(lower);
      if (!memberByEmail.has(lower)) {
        memberByEmail.set(lower, m);
      } else if (m.status === 'active') {
        memberByEmail.set(lower, { ...memberByEmail.get(lower)!, status: 'active' });
      }
      if (m.team_slug) {
        if (!memberTeamSlugs.has(lower)) memberTeamSlugs.set(lower, new Set());
        memberTeamSlugs.get(lower)!.add(m.team_slug);
      }
    }

    const catalogById = new Map<string, CatalogItem>();
    for (const c of data.catalog) {
      if (c.content_id) catalogById.set(c.content_id, c);
    }

    const activitiesByEmail = new Map<string, LearningActivity[]>();
    const activitiesByTeamSlug = new Map<string, LearningActivity[]>();

    for (const t of data.teams) {
      activitiesByTeamSlug.set(t.slug, []);
    }
    activitiesByTeamSlug.set(ORG_GENERAL_TEAM_SLUG, []);

    for (const a of data.activities) {
      const lower = (a.Member || '').toLowerCase();
      if (!lower) continue;

      if (!activitiesByEmail.has(lower)) activitiesByEmail.set(lower, []);
      activitiesByEmail.get(lower)!.push(a);

      const slugs = memberTeamSlugs.get(lower);
      if (slugs && slugs.size > 0) {
        for (const s of slugs) {
          if (!activitiesByTeamSlug.has(s)) activitiesByTeamSlug.set(s, []);
          activitiesByTeamSlug.get(s)!.push(a);
        }
      } else if (a.team_slug && activitiesByTeamSlug.has(a.team_slug)) {
        activitiesByTeamSlug.get(a.team_slug)!.push(a);
      } else {
        activitiesByTeamSlug.get(ORG_GENERAL_TEAM_SLUG)!.push(a);
      }
    }

    this.indexedContext = {
      memberByEmail,
      memberTeamSlugs,
      teamNameBySlug,
      uniqueSubteamEmails,
      activitiesByEmail,
      activitiesByTeamSlug,
      catalogById,
    };
    return this.indexedContext;
  }

  private resolveLearnerIdentity(email: string, fallbackName?: string, fallbackTeam?: string): {
    name: string;
    team_slug: string;
    team_name: string;
  } {
    const idx = this.getIndex();
    const lower = email.toLowerCase();
    const mem = idx.memberByEmail.get(lower);
    const name = mem
      ? `${mem.first_name} ${mem.last_name}`.trim() || formatNameFromEmail(email)
      : fallbackName || formatNameFromEmail(email);

    const slugs = idx.memberTeamSlugs.get(lower);
    const firstSlug = slugs ? Array.from(slugs)[0] : undefined;
    const team_slug = firstSlug || mem?.team_slug || ORG_GENERAL_TEAM_SLUG;
    const team_name =
      mem?.team_name ||
      (firstSlug ? idx.teamNameBySlug.get(firstSlug) : undefined) ||
      fallbackTeam ||
      ORG_GENERAL_TEAM_NAME;

    return { name, team_slug, team_name };
  }

  /**
   * Builds the effective list of teams, including the virtual "Organización General (Sin Equipo)"
   * whenever unassigned org-level learners exist (as in enterprise deployments with org-level seats).
   */
  private getEffectiveTeamsList(): Team[] {
    const data = this.getData();
    const idx = this.getIndex();

    const subteams: Team[] = data.teams.map((t) => ({
      ...t,
      member_count: data.members.filter((m) => m.team_slug === t.slug).length,
    }));

    const unassignedActs = idx.activitiesByTeamSlug.get(ORG_GENERAL_TEAM_SLUG) || [];
    const unassignedEmails = new Set(unassignedActs.map((a) => a.Member.toLowerCase()));

    const contracted = data.apiConfig.contractedLicenses || 500;
    const unassignedSeatCount =
      data.syncStatus.mode === 'live'
        ? Math.max(0, contracted - idx.uniqueSubteamEmails.size)
        : unassignedEmails.size;

    const result: Team[] = [...subteams];
    if (unassignedActs.length > 0 || (data.syncStatus.mode === 'live' && unassignedSeatCount > 0)) {
      result.unshift({
        name: ORG_GENERAL_TEAM_NAME,
        slug: ORG_GENERAL_TEAM_SLUG,
        description:
          'Colaboradores con licencia asignada a nivel Organización General que no están agrupados dentro de un sub-equipo específico.',
        active: true,
        member_count: unassignedSeatCount,
      });
    }

    // Sort active teams with real activity/members first so empty shell teams don't block the default view
    result.sort((a, b) => {
      const actsA = (idx.activitiesByTeamSlug.get(a.slug) || []).length;
      const actsB = (idx.activitiesByTeamSlug.get(b.slug) || []).length;
      // Put sub-teams with real activity first, or Org General right alongside them
      if ((actsA > 0) !== (actsB > 0)) return actsA > 0 ? -1 : 1;
      if (a.slug === ORG_GENERAL_TEAM_SLUG && actsA > 0) return -1;
      if (b.slug === ORG_GENERAL_TEAM_SLUG && actsB > 0) return 1;
      return actsB - actsA || (b.member_count || 0) - (a.member_count || 0);
    });

    return result;
  }

  public getApiConfig(): ApiConfig {
    const runtimeCfg = getRuntimeStorageConfig();
    const defaults = this.buildDefaultApiConfig();
    const stored =
      !this.inMemoryData &&
      (runtimeCfg.storageBackend === 'gcs' || runtimeCfg.storageBackend === 'bigquery')
        ? defaults
        : this.getData().apiConfig;

    if (runtimeCfg.runtimeEnv === 'cloud') {
      return {
        baseUrl: process.env.SKILLS_API_BASE_URL || stored.baseUrl || defaults.baseUrl,
        accessKey: process.env.SKILLS_ACCESS_KEY || stored.accessKey || '',
        secretKey: process.env.SKILLS_SECRET_KEY || stored.secretKey || '',
        organizationSlug:
          process.env.SKILLS_ORGANIZATION_SLUG || stored.organizationSlug || '',
        contractedLicenses:
          stored.contractedLicenses || defaults.contractedLicenses || 500,
      };
    }

    return {
      baseUrl: stored.baseUrl || defaults.baseUrl,
      accessKey: stored.accessKey || defaults.accessKey,
      secretKey: stored.secretKey || defaults.secretKey,
      organizationSlug: stored.organizationSlug || defaults.organizationSlug,
      contractedLicenses: stored.contractedLicenses || defaults.contractedLicenses || 500,
    };
  }

  public getMaskedApiConfig(): ApiConfig & { hasSecretKey: boolean; lockedInCloud: boolean } {
    const cfg = this.getApiConfig();
    const runtimeCfg = getRuntimeStorageConfig();
    const maskedSecret = cfg.secretKey
      ? `••••••••••••${cfg.secretKey.slice(-6)}`
      : '';
    return {
      ...cfg,
      secretKey: maskedSecret,
      hasSecretKey: Boolean(cfg.secretKey),
      lockedInCloud: runtimeCfg.lockSettingsInCloud,
    };
  }

  public saveApiConfig(config: Partial<ApiConfig>): ApiConfig {
    const data = this.getData();
    data.apiConfig = {
      ...data.apiConfig,
      ...config,
    };
    this.persist();
    return this.getApiConfig();
  }

  public getOrgStats(): OrganizationOfficialStats | undefined {
    return this.getData().orgStats;
  }

  public async saveOrgStats(stats: OrganizationOfficialStats): Promise<void> {
    const data = this.getData();
    data.orgStats = {
      ...stats,
      fetchedAt: new Date().toISOString(),
    };
    this.persist();
  }

  public async getCatalog(): Promise<CatalogItem[]> {
    return this.getData().catalog;
  }

  public async saveCatalog(items: CatalogItem[]): Promise<void> {
    const data = this.getData();
    data.catalog = items;
    this.persist();
  }

  public async getTeams(): Promise<Team[]> {
    return this.getEffectiveTeamsList();
  }

  public async saveTeams(teams: Team[]): Promise<void> {
    const data = this.getData();
    data.teams = teams;
    this.persist();
  }

  public async getMembers(): Promise<Member[]> {
    return this.getData().members;
  }

  public async saveMembers(members: Member[]): Promise<void> {
    const data = this.getData();
    data.members = members;
    this.persist();
  }

  public async getActivities(): Promise<LearningActivity[]> {
    return this.getData().activities;
  }

  public async saveActivities(activities: LearningActivity[]): Promise<LearningActivity[]> {
    const data = this.getData();
    data.activities = activities;
    this.persist();
    return data.activities;
  }

  public async getGoals(): Promise<TeamGoalConfig[]> {
    const data = this.getData();
    if (!data.goals || data.goals.length === 0) {
      data.goals = this.defaultGoals(data.teams);
      this.persist();
    }
    return data.goals;
  }

  public async upsertGoal(goal: TeamGoalConfig): Promise<TeamGoalConfig[]> {
    const data = this.getData();
    if (!data.goals) data.goals = this.defaultGoals(data.teams);
    const idx = data.goals.findIndex((g) => g.id === goal.id);
    if (idx >= 0) {
      data.goals[idx] = goal;
    } else {
      data.goals.push(goal);
    }
    this.persist();
    const rt = getRuntimeStorageConfig();
    if (rt.storageBackend === 'bigquery' && rt.bqProjectId) {
      await upsertGoalInBigQuery(goal).catch((err) =>
        console.error('⚠️ [BigQuery] Error guardando OKR:', err)
      );
    }
    return data.goals;
  }

  public async deleteGoal(id: string): Promise<TeamGoalConfig[]> {
    const data = this.getData();
    if (!data.goals) return [];
    data.goals = data.goals.filter((g) => g.id !== id);
    this.persist();
    const rt = getRuntimeStorageConfig();
    if (rt.storageBackend === 'bigquery' && rt.bqProjectId) {
      await deleteGoalInBigQuery(id).catch((err) =>
        console.error('⚠️ [BigQuery] Error eliminando OKR:', err)
      );
    }
    return data.goals;
  }

  public async getSyncStatus(): Promise<SyncStatus> {
    return this.getData().syncStatus;
  }

  public async updateSyncStatus(status: Partial<SyncStatus>): Promise<SyncStatus> {
    const data = this.getData();
    const nextMode = status.mode ?? data.syncStatus.mode;
    data.syncStatus = {
      ...data.syncStatus,
      ...status,
      counts: {
        catalog: data.catalog.length,
        teams: data.teams.length,
        members:
          nextMode === 'live'
            ? data.apiConfig.contractedLicenses || 500
            : data.members.length,
        activities: data.activities.length,
      },
    };
    if (status.status !== 'syncing') {
      this.persist();
    }
    return data.syncStatus;
  }

  public resetToDemo(): void {
    const currentConfig = this.inMemoryData?.apiConfig || this.buildDefaultApiConfig();
    const mockActivities = generateMockActivities();
    const seededTeams = MOCK_TEAMS.map((t) => ({
      ...t,
      member_count: MOCK_MEMBERS.filter((m) => m.team_slug === t.slug).length,
    }));
    this.inMemoryData = {
      apiConfig: currentConfig,
      orgStats: undefined,
      catalog: MOCK_CATALOG,
      teams: seededTeams,
      members: MOCK_MEMBERS,
      activities: mockActivities,
      goals: this.defaultGoals(seededTeams),
      syncStatus: {
        lastSyncAt: new Date().toISOString(),
        mode: 'demo',
        status: 'success',
        message: 'Restablecido al conjunto de datos de demostración de Google Skills',
        counts: {
          catalog: MOCK_CATALOG.length,
          teams: MOCK_TEAMS.length,
          members: MOCK_MEMBERS.length,
          activities: mockActivities.length,
        },
      },
    };
    this.persist();
  }

  private getReferenceTimeAndYear(activities: LearningActivity[]): {
    referenceTime: number;
    currentYear: number;
    currentYearLabel: string;
    startOfYearMs: number;
  } {
    let maxMs = 0;
    for (const a of activities) {
      const ds = a['Date completed'] || a['Date started'];
      if (ds) {
        const ms = Date.parse(ds);
        if (!isNaN(ms) && ms > maxMs) maxMs = ms;
      }
    }
    const referenceTime = maxMs > 0 ? maxMs : Date.now();
    const currentYear = new Date(referenceTime).getUTCFullYear();
    return {
      referenceTime,
      currentYear,
      currentYearLabel: String(currentYear),
      startOfYearMs: Date.UTC(currentYear, 0, 1),
    };
  }

  // ==========================================
  // MODULE 1: Overall Dashboard Metrics
  // ==========================================
  public async computeOverallStats(): Promise<OverallStats> {
    if (this.analyticsCache.has('overall')) return this.analyticsCache.get('overall');

    const data = this.getData();
    const activities = data.activities;
    const orgStats = data.orgStats;
    const isLive = data.syncStatus.mode === 'live';
    const { currentYearLabel, startOfYearMs } = this.getReferenceTimeAndYear(activities);

    const totalTrainingsTaken = activities.length;
    const successfulList = activities.filter(isSuccessfulCompletion);
    const finishedAttemptsCount = activities.filter((a) => Boolean(a['Date completed'])).length;
    const totalCompletions = successfulList.length;
    const totalPassed = successfulList.length;
    const passRate =
      finishedAttemptsCount > 0 ? Math.round((totalPassed / finishedAttemptsCount) * 100) : 0;

    const totalMinutes = activities.reduce(
      (acc, a) => acc + (Number(a['Learning time (minutes)']) || 0),
      0
    );
    const totalHoursSpent = Math.round((totalMinutes / 60) * 10) / 10;

    const learnerMap = new Map<
      string,
      {
        email: string;
        name: string;
        team: string;
        completedCount: number;
        passedCount: number;
        minutes: number;
      }
    >();
    const currentYearLearners = new Set<string>();

    for (const a of activities) {
      const email = a.Member;
      if (!email) continue;
      const lower = email.toLowerCase();
      let record = learnerMap.get(lower);
      if (!record) {
        const identity = this.resolveLearnerIdentity(email, a.memberName, a.team_name);
        record = {
          email,
          name: identity.name,
          team: identity.team_name,
          completedCount: 0,
          passedCount: 0,
          minutes: 0,
        };
        learnerMap.set(lower, record);
      }
      if (isSuccessfulCompletion(a)) {
        record.completedCount += 1;
        record.passedCount += 1;
      }
      record.minutes += Number(a['Learning time (minutes)']) || 0;

      const dStr = a['Date completed'] || a['Date started'];
      if (dStr) {
        const ms = Date.parse(dStr);
        if (!isNaN(ms) && ms >= startOfYearMs) {
          currentYearLearners.add(lower);
        }
      }
    }

    const totalActiveLearners = learnerMap.size;
    const avgHoursPerPerson =
      totalActiveLearners > 0
        ? Math.round((totalHoursSpent / totalActiveLearners) * 10) / 10
        : 0;

    const topLearners = Array.from(learnerMap.values())
      .map((l) => ({
        email: l.email,
        name: l.name,
        team: l.team,
        completedCount: l.completedCount,
        passedCount: l.passedCount,
        hoursSpent: Math.round((l.minutes / 60) * 10) / 10,
      }))
      .sort((a, b) => b.completedCount - a.completedCount || b.hoursSpent - a.hoursSpent)
      .slice(0, 25);

    // Most popular trainings
    const trainingMap = new Map<
      string,
      {
        name: string;
        content_id: string;
        type: string;
        takenCount: number;
        completedCount: number;
        scoreSum: number;
        scoreCount: number;
      }
    >();

    for (const a of activities) {
      const id = a['Content ID'] || a.Activity;
      let item = trainingMap.get(id);
      if (!item) {
        item = {
          name: a.Activity,
          content_id: a['Content ID'],
          type: a['Activity Type'],
          takenCount: 0,
          completedCount: 0,
          scoreSum: 0,
          scoreCount: 0,
        };
        trainingMap.set(id, item);
      }
      item.takenCount += 1;
      if (isSuccessfulCompletion(a)) item.completedCount += 1;
      const score = parseFloat(a['Given Score']);
      const maxScore = parseFloat(a['Maximum Score']);
      if (!isNaN(score) && maxScore > 0) {
        item.scoreSum += (score / maxScore) * 100;
        item.scoreCount += 1;
      }
    }

    const mostPopularTrainings = Array.from(trainingMap.values())
      .map((t) => ({
        name: t.name,
        content_id: t.content_id,
        type: t.type,
        takenCount: t.takenCount,
        completedCount: t.completedCount,
        avgScore: t.scoreCount > 0 ? Math.round(t.scoreSum / t.scoreCount) : 100,
      }))
      .sort((a, b) => b.takenCount - a.takenCount)
      .slice(0, 8);

    // Activity Type Breakdown
    const typeMap = new Map<string, { count: number; minutes: number }>();
    for (const a of activities) {
      const type = a['Activity Type'] || 'Course';
      let t = typeMap.get(type);
      if (!t) {
        t = { count: 0, minutes: 0 };
        typeMap.set(type, t);
      }
      t.count += 1;
      t.minutes += Number(a['Learning time (minutes)']) || 0;
    }

    const activityTypeBreakdown = Array.from(typeMap.entries()).map(([type, stats]) => ({
      type,
      count: stats.count,
      hours: Math.round((stats.minutes / 60) * 10) / 10,
    }));

    // Activity Timeline
    const timelineMap = new Map<string, { completions: number; minutes: number }>();
    for (const a of activities) {
      const dateStr = a['Date completed'] || a['Date started'];
      if (!dateStr) continue;
      // Fast YYYY-MM extraction for standard UTC strings "2026-10-19 19:25:42 UTC"
      const ymMatch = dateStr.match(/^(\d{4}-\d{2})/);
      let key = ymMatch ? ymMatch[1] : '';
      if (!key) {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) continue;
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      let entry = timelineMap.get(key);
      if (!entry) {
        entry = { completions: 0, minutes: 0 };
        timelineMap.set(key, entry);
      }
      if (isSuccessfulCompletion(a)) entry.completions += 1;
      entry.minutes += Number(a['Learning time (minutes)']) || 0;
    }

    const activityTimeline = Array.from(timelineMap.entries())
      .map(([date, val]) => ({
        date,
        completions: val.completions,
        hours: Math.round((val.minutes / 60) * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const contractedLicenses = data.apiConfig.contractedLicenses || 500;
    const currentYearActiveLearners = isLive ? currentYearLearners.size : totalActiveLearners;
    const unusedCurrentSeats = isLive
      ? Math.max(0, contractedLicenses - currentYearActiveLearners)
      : Math.max(0, data.members.length - totalActiveLearners);
    const estimatedRotatedSeats = orgStats?.accepted_invitations
      ? Math.max(0, orgStats.accepted_invitations - contractedLicenses)
      : 0;

    const result: OverallStats = {
      totalTrainingsTaken,
      totalCompletions,
      totalPassed,
      passRate,
      totalHoursSpent,
      avgHoursPerPerson,
      totalActiveLearners,
      currentYearLabel,
      currentYearActiveLearners,
      unusedCurrentSeats,
      estimatedRotatedSeats,
      skillsBadgesEarned: orgStats?.skills_badges_earned,
      officialLabsPassed: orgStats?.labs_passed,
      officialCoursesCompleted: orgStats?.courses_completed,
      officialAcceptedInvitations: orgStats?.accepted_invitations,
      officialPendingInvitations: orgStats?.pending_invitations,
      contractedLicenses,
      topLearners,
      mostPopularTrainings,
      activityTypeBreakdown,
      activityTimeline,
    };

    this.analyticsCache.set('overall', result);
    return result;
  }

  // ==========================================
  // MODULE 2: Team Analytics
  // ==========================================
  public async computeTeamStats(teamSlug?: string): Promise<TeamStats[]> {
    const cacheKey = `teams:${teamSlug || 'all'}`;
    if (this.analyticsCache.has(cacheKey)) return this.analyticsCache.get(cacheKey);

    const data = this.getData();
    const idx = this.getIndex();
    const effectiveTeams = this.getEffectiveTeamsList();
    const targetTeams = teamSlug
      ? effectiveTeams.filter((t) => t.slug === teamSlug)
      : effectiveTeams;

    const result = targetTeams.map((team) => {
      const teamMembers =
        team.slug === ORG_GENERAL_TEAM_SLUG
          ? []
          : data.members.filter((m) => m.team_slug === team.slug);
      const teamActivities = idx.activitiesByTeamSlug.get(team.slug) || [];

      const trainingsTaken = teamActivities.length;
      const completed = teamActivities.filter(isSuccessfulCompletion).length;
      const completionRate =
        trainingsTaken > 0 ? Math.round((completed / trainingsTaken) * 100) : 0;

      const totalMinutes = teamActivities.reduce(
        (acc, a) => acc + (Number(a['Learning time (minutes)']) || 0),
        0
      );
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

      const memberCount = team.member_count ?? teamMembers.length;
      const denom = memberCount || 1;
      const avgHoursPerMember = Math.round((totalHours / denom) * 10) / 10;

      // Focus Distribution
      const categoryMap = new Map<string, { count: number; minutes: number }>();
      for (const a of teamActivities) {
        const cat = a.category || 'Cloud Infrastructure';
        let c = categoryMap.get(cat);
        if (!c) {
          c = { count: 0, minutes: 0 };
          categoryMap.set(cat, c);
        }
        c.count += 1;
        c.minutes += Number(a['Learning time (minutes)']) || 0;
      }

      const focusDistribution = Array.from(categoryMap.entries())
        .map(([category, stats]) => ({
          category,
          count: stats.count,
          hours: Math.round((stats.minutes / 60) * 10) / 10,
          percentage:
            trainingsTaken > 0 ? Math.round((stats.count / trainingsTaken) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Most Popular Trainings for this team
      const teamCourseMap = new Map<string, { name: string; type: string; count: number }>();
      for (const a of teamActivities) {
        const id = a['Content ID'] || a.Activity;
        let c = teamCourseMap.get(id);
        if (!c) {
          c = { name: a.Activity, type: a['Activity Type'], count: 0 };
          teamCourseMap.set(id, c);
        }
        c.count += 1;
      }
      const mostPopularTrainings = Array.from(teamCourseMap.values())
        .map((t) => ({ name: t.name, type: t.type, takenCount: t.count }))
        .sort((a, b) => b.takenCount - a.takenCount)
        .slice(0, 5);

      // Top 10 members in team
      const memberStatsMap = new Map<
        string,
        { email: string; name: string; completed: number; minutes: number }
      >();
      for (const m of teamMembers) {
        memberStatsMap.set(m.email.toLowerCase(), {
          email: m.email,
          name: `${m.first_name} ${m.last_name}`.trim() || formatNameFromEmail(m.email),
          completed: 0,
          minutes: 0,
        });
      }
      for (const a of teamActivities) {
        const lower = a.Member.toLowerCase();
        let memStat = memberStatsMap.get(lower);
        if (!memStat) {
          const identity = this.resolveLearnerIdentity(a.Member, a.memberName, team.name);
          memStat = {
            email: a.Member,
            name: identity.name,
            completed: 0,
            minutes: 0,
          };
          memberStatsMap.set(lower, memStat);
        }
        if (isSuccessfulCompletion(a)) memStat.completed += 1;
        memStat.minutes += Number(a['Learning time (minutes)']) || 0;
      }

      const top10Members = Array.from(memberStatsMap.values())
        .map((m) => ({
          email: m.email,
          name: m.name,
          completedCount: m.completed,
          hoursSpent: Math.round((m.minutes / 60) * 10) / 10,
        }))
        .sort((a, b) => b.completedCount - a.completedCount || b.hoursSpent - a.hoursSpent)
        .slice(0, 10);

      return {
        team_slug: team.slug,
        name: team.name,
        description: team.description,
        member_count: memberCount,
        trainingsTaken,
        trainingsCompleted: completed,
        completionRate,
        totalHours,
        avgHoursPerMember,
        focusDistribution,
        mostPopularTrainings,
        top10Members,
      };
    });

    this.analyticsCache.set(cacheKey, result);
    return result;
  }

  // ==========================================
  // MODULE 2 DRILLDOWN: Individual Learner Details
  // ==========================================
  public async computeMemberDrilldown(email: string): Promise<MemberDrilldown | null> {
    const idx = this.getIndex();
    const lower = email.toLowerCase();
    const member = idx.memberByEmail.get(lower);
    const memberActivities = idx.activitiesByEmail.get(lower) || [];

    if (!member && memberActivities.length === 0) {
      return null;
    }

    const identity = this.resolveLearnerIdentity(
      email,
      memberActivities[0]?.memberName,
      memberActivities[0]?.team_name
    );

    const totalActivities = memberActivities.length;
    const passedList = memberActivities.filter(isSuccessfulCompletion);
    const finishedAttempts = memberActivities.filter((a) => Boolean(a['Date completed'])).length;
    const completedActivities = passedList.length;
    const passRate =
      finishedAttempts > 0 ? Math.round((passedList.length / finishedAttempts) * 100) : 0;

    const totalMinutes = memberActivities.reduce(
      (acc, a) => acc + (Number(a['Learning time (minutes)']) || 0),
      0
    );
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    const catMap = new Map<string, { count: number; minutes: number }>();
    for (const a of memberActivities) {
      const cat = a.category || 'Cloud Infrastructure';
      let c = catMap.get(cat);
      if (!c) {
        c = { count: 0, minutes: 0 };
        catMap.set(cat, c);
      }
      c.count += 1;
      c.minutes += Number(a['Learning time (minutes)']) || 0;
    }

    const categories = Array.from(catMap.entries())
      .map(([category, s]) => ({
        category,
        count: s.count,
        hours: Math.round((s.minutes / 60) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      email,
      name: identity.name,
      team_slug: identity.team_slug,
      team_name: identity.team_name,
      totalActivities,
      completedActivities,
      totalHours,
      passRate,
      categories,
      activities: memberActivities.slice(0, 150),
    };
  }

  // ==========================================
  // DASHBOARD 1: ADOPTION, LICENSES & RETENTION (ROI)
  // ==========================================
  public async computeAdoptionStats(): Promise<AdoptionStats> {
    if (this.analyticsCache.has('adoption')) return this.analyticsCache.get('adoption');

    const data = this.getData();
    const idx = this.getIndex();
    const activities = data.activities;
    const orgStats = data.orgStats;
    const isLive = data.syncStatus.mode === 'live';

    const uniqueMemberMap = new Map<
      string,
      {
        email: string;
        name: string;
        team_name: string;
        status: 'active' | 'pending' | 'revoked';
      }
    >();

    for (const m of data.members) {
      const lower = m.email.toLowerCase();
      const identity = this.resolveLearnerIdentity(m.email);
      if (!uniqueMemberMap.has(lower)) {
        uniqueMemberMap.set(lower, {
          email: m.email,
          name: identity.name,
          team_name: identity.team_name,
          status: m.status || 'active',
        });
      } else if (m.status === 'active') {
        uniqueMemberMap.get(lower)!.status = 'active';
      }
    }

    for (const [lower, acts] of idx.activitiesByEmail.entries()) {
      if (!uniqueMemberMap.has(lower)) {
        const sample = acts[0];
        const identity = this.resolveLearnerIdentity(
          sample.Member,
          sample.memberName,
          sample.team_name
        );
        uniqueMemberMap.set(lower, {
          email: sample.Member,
          name: identity.name,
          team_name: identity.team_name,
          status: 'active',
        });
      }
    }

    const { referenceTime, currentYear, currentYearLabel, startOfYearMs } =
      this.getReferenceTimeAndYear(activities);
    const cutoff12mMs = referenceTime - 365 * 24 * 60 * 60 * 1000;
    const cutoff30dMs = referenceTime - 30 * 24 * 60 * 60 * 1000;
    let minYear = currentYear;

    const learnerActivityStats = new Map<
      string,
      {
        startedAll: number;
        completedAll: number;
        startedCurrentYear: number;
        minutes: number;
        lastDateMs: number | null;
        lastDateStr: string | null;
      }
    >();

    for (const [lower, acts] of idx.activitiesByEmail.entries()) {
      let completedAll = 0;
      let startedCurrentYear = 0;
      let minutes = 0;
      let lastDateMs: number | null = null;
      let lastDateStr: string | null = null;

      for (const a of acts) {
        if (isSuccessfulCompletion(a)) completedAll += 1;
        minutes += Number(a['Learning time (minutes)']) || 0;
        const dStr = a['Date completed'] || a['Date started'];
        if (dStr) {
          const ms = Date.parse(dStr);
          if (!isNaN(ms)) {
            const yr = new Date(ms).getUTCFullYear();
            if (yr >= 2015 && yr < minYear) minYear = yr;
            if (ms >= startOfYearMs) {
              startedCurrentYear += 1;
            }
            if (lastDateMs === null || ms > lastDateMs) {
              lastDateMs = ms;
              lastDateStr = dStr.split(' ')[0].split('T')[0];
            }
          }
        }
      }

      learnerActivityStats.set(lower, {
        startedAll: acts.length,
        completedAll,
        startedCurrentYear,
        minutes,
        lastDateMs,
        lastDateStr,
      });
    }

    let rosterActiveInvites = 0;
    let rosterPendingInvites = 0;
    let rosterRevokedInvites = 0;
    let historicalLearnersCount = 0;
    let historicalRecurringCount = 0;
    let currentYearLearnersCount = 0;
    let currentYearRecurringCount = 0;
    let activeLast12Months = 0;
    let activeLast30Days = 0;
    let priorCohortsCount = 0;
    let rosterZeroCount = 0;
    let atRiskCount = 0;

    const memberStatuses: AdoptionStats['memberStatuses'] = [];

    for (const [lower, m] of uniqueMemberMap.entries()) {
      if (m.status === 'pending') rosterPendingInvites++;
      else if (m.status === 'revoked') rosterRevokedInvites++;
      else rosterActiveInvites++;

      const act = learnerActivityStats.get(lower);
      const startedAll = act?.startedAll || 0;
      const completedAll = act?.completedAll || 0;
      const startedCurrent = isLive ? act?.startedCurrentYear || 0 : startedAll;
      const hoursSpent = Math.round(((act?.minutes || 0) / 60) * 10) / 10;

      let daysSince: number | null = null;
      if (act?.lastDateMs) {
        daysSince = Math.max(
          0,
          Math.floor((referenceTime - act.lastDateMs) / (1000 * 60 * 60 * 24))
        );
      }

      const isActiveLast30d = Boolean(act?.lastDateMs && act.lastDateMs >= cutoff30dMs);

      if (startedAll > 0) {
        historicalLearnersCount++;
        if (startedAll >= 3) historicalRecurringCount++;
        if (act?.lastDateMs && act.lastDateMs >= cutoff12mMs) activeLast12Months++;
        if (isActiveLast30d) activeLast30Days++;
      }

      let riskStatus: 'Activo' | 'En Riesgo' | 'Sin Uso' | 'Cohorte Previa' = 'Sin Uso';
      if (startedAll === 0) {
        rosterZeroCount++;
        riskStatus = 'Sin Uso';
      } else if (startedCurrent === 0) {
        priorCohortsCount++;
        riskStatus = 'Cohorte Previa';
      } else {
        currentYearLearnersCount++;
        if (startedCurrent >= 3) currentYearRecurringCount++;
        if (!isActiveLast30d) {
          atRiskCount++;
          riskStatus = 'En Riesgo';
          if (daysSince !== null && daysSince <= 30) daysSince = 31;
        } else {
          riskStatus = 'Activo';
        }
      }

      memberStatuses.push({
        email: m.email,
        name: m.name,
        team_name: m.team_name,
        inviteStatus: m.status,
        activitiesStarted: startedAll,
        activitiesCompleted: completedAll,
        hoursSpent,
        lastActivityDate: act?.lastDateStr || null,
        daysSinceLastActivity: daysSince,
        riskStatus,
      });
    }

    memberStatuses.sort((a, b) => {
      const order = { 'Sin Uso': 0, 'En Riesgo': 1, Activo: 2, 'Cohorte Previa': 3 };
      if (order[a.riskStatus] !== order[b.riskStatus]) {
        return order[a.riskStatus] - order[b.riskStatus];
      }
      return b.hoursSpent - a.hoursSpent;
    });

    // Current Contracted License Pool (e.g. 500 concurrent active seats) vs Multi-Year Historical Counters
    const contractedLicenses = isLive
      ? data.apiConfig.contractedLicenses || 500
      : uniqueMemberMap.size;

    const officialAccepted = orgStats?.accepted_invitations || rosterActiveInvites;
    const officialPending = orgStats?.pending_invitations ?? rosterPendingInvites;
    const officialCumulativeLearners =
      orgStats?.cumulative_learners || historicalLearnersCount;

    const totalSeats = contractedLicenses;
    const learnersWithActivity = isLive ? currentYearLearnersCount : historicalLearnersCount;
    const recurringLearners = isLive ? currentYearRecurringCount : historicalRecurringCount;

    const zeroActivityCount = isLive
      ? Math.max(0, totalSeats - learnersWithActivity)
      : rosterZeroCount;

    const unidentifiedInactiveSeats = Math.max(0, zeroActivityCount - rosterZeroCount);

    const activationRate =
      totalSeats > 0
        ? Math.min(100, Math.round((learnersWithActivity / totalSeats) * 100))
        : 0;

    const totalStartedActs = activities.length;
    const totalCompletedActs = activities.filter(isSuccessfulCompletion).length;
    const overallDropOffRate =
      totalStartedActs > 0
        ? Math.round(((totalStartedActs - totalCompletedActs) / totalStartedActs) * 100)
        : 0;

    const seatDenom = Math.max(totalSeats, 1);
    const funnel: AdoptionStats['funnel'] = isLive
      ? [
          {
            stage: 'Cupo de Licencias Contratadas (Vigentes)',
            count: totalSeats,
            percentage: 100,
          },
          {
            stage: 'Con Actividad en Últimos 12 Meses',
            count: Math.min(totalSeats, activeLast12Months),
            percentage: Math.min(100, Math.round((activeLast12Months / seatDenom) * 100)),
          },
          {
            stage: `Con Uso de Licencia en ${currentYearLabel} (≥ 1 módulo)`,
            count: Math.min(totalSeats, learnersWithActivity),
            percentage: Math.min(100, Math.round((learnersWithActivity / seatDenom) * 100)),
          },
          {
            stage: `Aprendices Recurrentes en ${currentYearLabel} (≥ 3 módulos)`,
            count: Math.min(totalSeats, recurringLearners),
            percentage: Math.min(100, Math.round((recurringLearners / seatDenom) * 100)),
          },
          {
            stage: 'Activos en los Últimos 30 Días',
            count: Math.min(totalSeats, activeLast30Days),
            percentage: Math.min(100, Math.round((activeLast30Days / seatDenom) * 100)),
          },
        ]
      : [
          {
            stage: 'Licencias Asignadas',
            count: totalSeats,
            percentage: 100,
          },
          {
            stage: 'Invitaciones Aceptadas (Cuentas Activas)',
            count: Math.min(totalSeats, officialAccepted),
            percentage: Math.min(100, Math.round((officialAccepted / seatDenom) * 100)),
          },
          {
            stage: 'Estudiantes con ≥ 1 Curso / Lab Iniciado',
            count: Math.min(totalSeats, learnersWithActivity),
            percentage: Math.min(100, Math.round((learnersWithActivity / seatDenom) * 100)),
          },
          {
            stage: 'Aprendices Recurrentes (≥ 3 Módulos)',
            count: Math.min(totalSeats, recurringLearners),
            percentage: Math.min(100, Math.round((recurringLearners / seatDenom) * 100)),
          },
        ];

    const periodLabel =
      isLive && minYear < currentYear ? `${minYear}–${currentYearLabel}` : currentYearLabel;
    const totalInvitationsSent = officialAccepted + officialPending;
    const estimatedRotatedSeats = Math.max(0, officialAccepted - totalSeats);
    const historicalLearnersWithActivity = Math.max(
      historicalLearnersCount,
      isLive ? officialCumulativeLearners : 0
    );
    const priorCohortsInactiveThisYear = Math.max(
      0,
      historicalLearnersWithActivity - learnersWithActivity
    );
    const histDenom = Math.max(totalInvitationsSent, historicalLearnersWithActivity, 1);

    const historicalSummary: AdoptionStats['historicalSummary'] = {
      periodLabel,
      totalInvitationsSent,
      acceptedInvitationsAllTime: officialAccepted,
      pendingInvitations: officialPending,
      estimatedRotatedSeats,
      historicalLearnersWithActivity,
      priorCohortsInactiveThisYear,
      historicalRecurringLearners: historicalRecurringCount,
      funnel: [
        {
          stage: `Invitaciones Emitidas Acumuladas (${periodLabel})`,
          count: totalInvitationsSent,
          percentage: Math.min(100, Math.round((totalInvitationsSent / histDenom) * 100)),
        },
        {
          stage: 'Invitaciones Aceptadas Históricas (incluye rotación)',
          count: officialAccepted,
          percentage: Math.min(100, Math.round((officialAccepted / histDenom) * 100)),
        },
        {
          stage: 'Colaboradores Formados Históricos (≥ 1 módulo)',
          count: historicalLearnersWithActivity,
          percentage: Math.min(
            100,
            Math.round((historicalLearnersWithActivity / histDenom) * 100)
          ),
        },
        {
          stage: 'Aprendices Recurrentes Históricos (≥ 3 módulos)',
          count: historicalRecurringCount,
          percentage: Math.min(100, Math.round((historicalRecurringCount / histDenom) * 100)),
        },
      ],
    };

    // Team Adoption breakdown across effective teams (strictly aligned with the current contracted seat pool)
    const effectiveTeams = this.getEffectiveTeamsList();
    const activeSubteamCurrentCount = Array.from(idx.uniqueSubteamEmails).filter((em) => {
      const s = learnerActivityStats.get(em);
      return (isLive ? s?.startedCurrentYear || 0 : s?.startedAll || 0) > 0;
    }).length;

    const teamAdoption = effectiveTeams
      .map((t) => {
        if (t.slug === ORG_GENERAL_TEAM_SLUG) {
          const activeInOrgGen = Math.max(0, learnersWithActivity - activeSubteamCurrentCount);
          const totalM = Math.max(t.member_count || 0, activeInOrgGen);
          return {
            team_slug: t.slug,
            team_name: t.name,
            totalMembers: totalM,
            activeLearners: activeInOrgGen,
            inactiveLearners: Math.max(0, totalM - activeInOrgGen),
            adoptionRate: totalM > 0 ? Math.round((activeInOrgGen / totalM) * 100) : 0,
          };
        }

        const tMembers = data.members.filter((m) => m.team_slug === t.slug);
        const uniqueEmails = Array.from(new Set(tMembers.map((m) => m.email.toLowerCase())));
        const activeInTeam = uniqueEmails.filter((email) => {
          const s = learnerActivityStats.get(email);
          return (isLive ? s?.startedCurrentYear || 0 : s?.startedAll || 0) > 0;
        }).length;
        const totalM = uniqueEmails.length;
        return {
          team_slug: t.slug,
          team_name: t.name,
          totalMembers: totalM,
          activeLearners: activeInTeam,
          inactiveLearners: Math.max(0, totalM - activeInTeam),
          adoptionRate: totalM > 0 ? Math.round((activeInTeam / totalM) * 100) : 0,
        };
      })
      .filter((t) => t.totalMembers > 0 || t.activeLearners > 0)
      .sort((a, b) => b.activeLearners - a.activeLearners || b.adoptionRate - a.adoptionRate);

    // Drop-off / Abandoned courses
    const courseDropMap = new Map<
      string,
      { name: string; type: string; started: number; completed: number }
    >();

    for (const a of activities) {
      const key = a['Content ID'] || a.Activity;
      let entry = courseDropMap.get(key);
      if (!entry) {
        entry = {
          name: a.Activity,
          type: a['Activity Type'] || 'Lab',
          started: 0,
          completed: 0,
        };
        courseDropMap.set(key, entry);
      }
      entry.started += 1;
      if (isSuccessfulCompletion(a)) entry.completed += 1;
    }

    const dropOffCourses = Array.from(courseDropMap.values())
      .map((c) => {
        const abandoned = Math.max(0, c.started - c.completed);
        return {
          name: c.name,
          type: c.type,
          startedCount: c.started,
          completedCount: c.completed,
          abandonedCount: abandoned,
          dropOffRate: c.started > 0 ? Math.round((abandoned / c.started) * 100) : 0,
        };
      })
      .filter((c) => c.abandonedCount > 0 && c.startedCount >= 2)
      .sort((a, b) => b.abandonedCount - a.abandonedCount || b.dropOffRate - a.dropOffRate)
      .slice(0, 10);

    const result: AdoptionStats = {
      currentYearLabel,
      totalSeats,
      contractedLicenses,
      unidentifiedInactiveSeats,
      activeLast12Months,
      activeLast30Days,
      invitedStatusCounts: {
        active: officialAccepted,
        pending: officialPending,
        revoked: rosterRevokedInvites,
      },
      learnersWithActivity,
      recurringLearners,
      zeroActivityCount,
      atRiskCount,
      activationRate,
      overallDropOffRate,
      funnel,
      historicalSummary,
      teamAdoption,
      memberStatuses,
      dropOffCourses,
    };

    this.analyticsCache.set('adoption', result);
    return result;
  }

  // ==========================================
  // DASHBOARD 2: SKILL GAP MATRIX & MATURITY
  // ==========================================
  public async computeSkillMatrix(): Promise<SkillMatrixStats> {
    if (this.analyticsCache.has('matrix')) return this.analyticsCache.get('matrix');

    const data = this.getData();
    const idx = this.getIndex();
    const effectiveTeams = this.getEffectiveTeamsList();
    const activities = data.activities;

    const discoveredCats = new Set<string>(CORE_CATEGORIES);
    for (const a of activities) {
      if (a.category) discoveredCats.add(a.category);
    }
    const categories = Array.from(discoveredCats);

    let maxCellHours = 0.1;

    const rawRows = effectiveTeams.map((team) => {
      const teamActs = idx.activitiesByTeamSlug.get(team.slug) || [];
      let totalMinutes = 0;

      const catAcc = new Map<string, { count: number; mins: number }>();
      for (const a of teamActs) {
        const cat = a.category || 'Cloud Infrastructure';
        let b = catAcc.get(cat);
        if (!b) {
          b = { count: 0, mins: 0 };
          catAcc.set(cat, b);
        }
        b.count += 1;
        b.mins += Number(a['Learning time (minutes)']) || 0;
      }

      const cells = categories.map((cat) => {
        const bucket = catAcc.get(cat) || { count: 0, mins: 0 };
        totalMinutes += bucket.mins;
        const hrs = Math.round((bucket.mins / 60) * 10) / 10;
        // Exclude massive Org General row from distorting sub-team heatmap color scale
        if (team.slug !== ORG_GENERAL_TEAM_SLUG && hrs > maxCellHours) {
          maxCellHours = hrs;
        }
        return {
          category: cat,
          count: bucket.count,
          hours: hrs,
          intensity: 0,
        };
      });

      return {
        team_slug: team.slug,
        team_name: team.name,
        member_count: team.member_count || 0,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        cells,
      };
    });

    if (maxCellHours <= 0.1) {
      for (const r of rawRows) {
        for (const c of r.cells) {
          if (c.hours > maxCellHours) maxCellHours = c.hours;
        }
      }
    }

    const heatmapRows = rawRows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({
        ...cell,
        intensity:
          cell.hours > 0
            ? Math.min(100, Math.max(18, Math.round((cell.hours / maxCellHours) * 100)))
            : 0,
      })),
    }));

    const globalCatAcc = new Map<string, { count: number; mins: number }>();
    for (const a of activities) {
      const cat = a.category || 'Cloud Infrastructure';
      let b = globalCatAcc.get(cat);
      if (!b) {
        b = { count: 0, mins: 0 };
        globalCatAcc.set(cat, b);
      }
      b.count += 1;
      b.mins += Number(a['Learning time (minutes)']) || 0;
    }

    const categoryTotals = categories
      .map((cat) => {
        const st = globalCatAcc.get(cat) || { count: 0, mins: 0 };
        const teamsCovered = heatmapRows.filter((r) => {
          const c = r.cells.find((x) => x.category === cat);
          return c && c.count > 0;
        }).length;
        return {
          category: cat,
          count: st.count,
          hours: Math.round((st.mins / 60) * 10) / 10,
          teamsCovered,
          totalTeams: heatmapRows.length,
          coverageRate:
            heatmapRows.length > 0 ? Math.round((teamsCovered / heatmapRows.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.hours - a.hours);

    const levelBuckets = new Map<string, { count: number; minutes: number }>([
      ['introductory', { count: 0, minutes: 0 }],
      ['intermediate', { count: 0, minutes: 0 }],
      ['advanced', { count: 0, minutes: 0 }],
    ]);

    for (const a of activities) {
      const catItem = idx.catalogById.get(a['Content ID']);
      let lvl = catItem?.level?.toLowerCase() || '';
      if (!lvl) {
        const lowerName = (a.Activity || '').toLowerCase();
        if (
          lowerName.includes('fundamental') ||
          lowerName.includes('get started') ||
          lowerName.includes('getting started') ||
          lowerName.includes('intro') ||
          lowerName.includes('essential') ||
          lowerName.includes('leader')
        ) {
          lvl = 'introductory';
        } else if (
          lowerName.includes('architect') ||
          lowerName.includes('professional') ||
          lowerName.includes('advanced') ||
          lowerName.includes('security')
        ) {
          lvl = 'advanced';
        } else {
          lvl = 'intermediate';
        }
      }
      if (!levelBuckets.has(lvl)) lvl = 'intermediate';
      const bucket = levelBuckets.get(lvl)!;
      bucket.count += 1;
      bucket.minutes += Number(a['Learning time (minutes)']) || 0;
    }

    const totalActs = activities.length || 1;
    const levelDistribution = Array.from(levelBuckets.entries()).map(([level, st]) => ({
      level,
      count: st.count,
      hours: Math.round((st.minutes / 60) * 10) / 10,
      percentage: activities.length > 0 ? Math.round((st.count / totalActs) * 100) : 0,
    }));

    const criticalGaps = heatmapRows
      .map((row) => ({
        team_name: row.team_name,
        missingCategories: row.cells.filter((c) => c.count === 0).map((c) => c.category),
      }))
      .filter((g) => g.missingCategories.length > 0);

    const result: SkillMatrixStats = {
      categories,
      heatmapRows,
      categoryTotals,
      levelDistribution,
      criticalGaps,
    };

    this.analyticsCache.set('matrix', result);
    return result;
  }

  // ==========================================
  // DASHBOARD 3: LEARNING PATHS & CERTIFICATIONS
  // ==========================================
  public async computeCertificationStats(): Promise<CertificationStats> {
    if (this.analyticsCache.has('certifications')) return this.analyticsCache.get('certifications');

    const data = this.getData();
    const activities = data.activities;

    const inferCertificationTrack = (
      a: LearningActivity
    ): { track: string; parentType: string; isCert: boolean } => {
      if (a['Parent Name']) {
        const pName = a['Parent Name'];
        const isCert =
          pName.toLowerCase().includes('certification') ||
          pName.toLowerCase().includes('architect') ||
          pName.toLowerCase().includes('leader') ||
          pName.toLowerCase().includes('engineer');
        return {
          track: pName,
          parentType: a['Parent Type'] || 'Path',
          isCert,
        };
      }
      const cat = a.category || 'Cloud Infrastructure';
      if (cat === 'AI & Machine Learning') {
        return {
          track: 'Generative AI Leader / Professional ML Engineer',
          parentType: 'Certification Track',
          isCert: true,
        };
      }
      if (cat === 'Data & Analytics') {
        return {
          track: 'Professional Data Engineer & Looker BI',
          parentType: 'Certification Track',
          isCert: true,
        };
      }
      if (cat === 'Cloud Security & IAM') {
        return {
          track: 'Professional Cloud Security Engineer',
          parentType: 'Certification Track',
          isCert: true,
        };
      }
      if (cat === 'Containers & Kubernetes' || cat === 'DevOps & SRE') {
        return {
          track: 'Professional Cloud DevOps & Kubernetes Engine',
          parentType: 'Certification Track',
          isCert: true,
        };
      }
      return {
        track: 'Associate Cloud Engineer / Cloud Digital Leader',
        parentType: 'Certification Track',
        isCert: true,
      };
    };

    const pathMap = new Map<
      string,
      {
        pathName: string;
        parentType: string;
        isOfficialCertTrack: boolean;
        category: string;
        learners: Set<string>;
        completed: number;
        minutes: number;
        scoreSum: number;
        scoreCount: number;
      }
    >();

    const candidateMap = new Map<
      string,
      {
        email: string;
        sampleName?: string;
        sampleTeam?: string;
        track: string;
        completedModules: number;
        passedModules: number;
        minutes: number;
        scoreSum: number;
        scoreCount: number;
      }
    >();

    let activitiesInExplicitPaths = 0;

    for (const a of activities) {
      if (a['Parent Name']) activitiesInExplicitPaths++;
      const { track, parentType, isCert } = inferCertificationTrack(a);

      let p = pathMap.get(track);
      if (!p) {
        p = {
          pathName: track,
          parentType,
          isOfficialCertTrack: isCert,
          category: a.category || 'Cloud Infrastructure',
          learners: new Set(),
          completed: 0,
          minutes: 0,
          scoreSum: 0,
          scoreCount: 0,
        };
        pathMap.set(track, p);
      }

      const lower = a.Member.toLowerCase();
      p.learners.add(lower);
      const passed = isSuccessfulCompletion(a);
      if (passed) p.completed += 1;
      p.minutes += Number(a['Learning time (minutes)']) || 0;

      const given = parseFloat(a['Given Score']);
      const max = parseFloat(a['Maximum Score']);
      if (!isNaN(given) && max > 0) {
        p.scoreSum += (given / max) * 100;
        p.scoreCount += 1;
      }

      const candKey = `${lower}::${track}`;
      let cand = candidateMap.get(candKey);
      if (!cand) {
        cand = {
          email: a.Member,
          sampleName: a.memberName,
          sampleTeam: a.team_name,
          track,
          completedModules: 0,
          passedModules: 0,
          minutes: 0,
          scoreSum: 0,
          scoreCount: 0,
        };
        candidateMap.set(candKey, cand);
      }
      if (Boolean(a['Date completed'])) cand.completedModules += 1;
      if (passed) cand.passedModules += 1;
      cand.minutes += Number(a['Learning time (minutes)']) || 0;
      if (!isNaN(given) && max > 0) {
        cand.scoreSum += (given / max) * 100;
        cand.scoreCount += 1;
      }
    }

    const pathsOverview = Array.from(pathMap.values())
      .map((p) => ({
        pathName: p.pathName,
        parentType: p.parentType,
        isOfficialCertTrack: p.isOfficialCertTrack,
        category: p.category,
        learnersEnrolled: p.learners.size,
        activitiesCompleted: p.completed,
        totalHours: Math.round((p.minutes / 60) * 10) / 10,
        avgScore: p.scoreCount > 0 ? Math.round(p.scoreSum / p.scoreCount) : 100,
      }))
      .sort((a, b) => b.activitiesCompleted - a.activitiesCompleted || b.totalHours - a.totalHours)
      .slice(0, 18);

    const bestCandidatePerLearner = new Map<string, CertificationStats['voucherCandidates'][0]>();

    for (const c of candidateMap.values()) {
      const lower = c.email.toLowerCase();
      const identity = this.resolveLearnerIdentity(c.email, c.sampleName, c.sampleTeam);

      const avgScore =
        c.scoreCount > 0
          ? Math.round(c.scoreSum / c.scoreCount)
          : c.passedModules > 0
          ? 100
          : 75;
      const hoursSpent = Math.round((c.minutes / 60) * 10) / 10;

      const volumePct = Math.min(100, Math.round((c.passedModules / 6) * 100));
      const passAccuracy =
        c.completedModules > 0 ? Math.round((c.passedModules / c.completedModules) * 100) : 0;
      const readinessScore = Math.min(100, Math.round(volumePct * 0.65 + passAccuracy * 0.35));

      let status: 'Listo para Voucher' | 'En Progreso Avanzado' | 'Inicial' = 'Inicial';
      if (readinessScore >= 80 && c.passedModules >= 5) {
        status = 'Listo para Voucher';
      } else if (readinessScore >= 50 || c.passedModules >= 2) {
        status = 'En Progreso Avanzado';
      }

      const candidateObj: CertificationStats['voucherCandidates'][0] = {
        email: c.email,
        name: identity.name,
        team_name: identity.team_name,
        targetTrack: c.track,
        completedModules: Math.max(c.completedModules, c.passedModules),
        passedModules: c.passedModules,
        avgScore,
        hoursSpent,
        readinessScore,
        status,
      };

      const existing = bestCandidatePerLearner.get(lower);
      if (
        !existing ||
        candidateObj.readinessScore > existing.readinessScore ||
        (candidateObj.readinessScore === existing.readinessScore &&
          candidateObj.passedModules > existing.passedModules)
      ) {
        bestCandidatePerLearner.set(lower, candidateObj);
      }
    }

    const allCandidatesSorted = Array.from(bestCandidatePerLearner.values()).sort(
      (a, b) =>
        b.readinessScore - a.readinessScore ||
        b.passedModules - a.passedModules ||
        b.hoursSpent - a.hoursSpent
    );

    const certificationReadyCount = allCandidatesSorted.filter(
      (v) => v.status === 'Listo para Voucher'
    ).length;

    const result: CertificationStats = {
      totalPathsTracked: pathMap.size,
      totalActivitiesInPaths:
        activitiesInExplicitPaths > 0 ? activitiesInExplicitPaths : activities.length,
      certificationReadyCount,
      pathsOverview,
      voucherCandidates: allCandidatesSorted.slice(0, 100),
    };

    this.analyticsCache.set('certifications', result);
    return result;
  }

  // ==========================================
  // DASHBOARD 4: TEAM BENCHMARKING & EFFICIENCY
  // ==========================================
  public async computeBenchmarkingStats(): Promise<BenchmarkingStats> {
    if (this.analyticsCache.has('benchmarking')) return this.analyticsCache.get('benchmarking');

    const data = this.getData();
    const idx = this.getIndex();
    const effectiveTeams = this.getEffectiveTeamsList();
    const activities = data.activities;
    const isLive = data.syncStatus.mode === 'live';
    const { startOfYearMs } = this.getReferenceTimeAndYear(activities);

    const rawTeamRows = effectiveTeams.map((team) => {
      const teamActs = idx.activitiesByTeamSlug.get(team.slug) || [];
      const activeAllTimeSet = new Set<string>();
      const activeCurrentYearSet = new Set<string>();
      for (const a of teamActs) {
        const lower = (a.Member || '').toLowerCase();
        if (!lower) continue;
        activeAllTimeSet.add(lower);
        const dStr = a['Date completed'] || a['Date started'];
        if (dStr) {
          const ms = Date.parse(dStr);
          if (!isNaN(ms) && ms >= startOfYearMs) {
            activeCurrentYearSet.add(lower);
          }
        }
      }

      const activeLearners = isLive ? activeCurrentYearSet.size : activeAllTimeSet.size;
      const memberCount = Math.max(team.member_count || 0, activeLearners);
      const participationRate =
        memberCount > 0 ? Math.min(100, Math.round((activeLearners / memberCount) * 100)) : 0;

      const mins = teamActs.reduce(
        (acc, a) => acc + (Number(a['Learning time (minutes)']) || 0),
        0
      );
      const totalHours = Math.round((mins / 60) * 10) / 10;
      const avgHoursPerMember =
        memberCount > 0 ? Math.round((totalHours / memberCount) * 10) / 10 : 0;
      const avgHoursPerActiveLearner =
        activeAllTimeSet.size > 0
          ? Math.round((totalHours / activeAllTimeSet.size) * 10) / 10
          : 0;

      const finishedAttempts = teamActs.filter((a) => Boolean(a['Date completed'])).length;
      const passed = teamActs.filter(isSuccessfulCompletion).length;
      const passRate =
        finishedAttempts > 0 ? Math.round((passed / finishedAttempts) * 100) : 0;

      const hoursNormalized = Math.min(100, Math.round((avgHoursPerMember / 8) * 100));
      const efficiencyScore = Math.round(
        participationRate * 0.4 + hoursNormalized * 0.35 + passRate * 0.25
      );

      return {
        rank: 0,
        team_slug: team.slug,
        team_name: team.name,
        member_count: memberCount,
        activeLearners,
        participationRate,
        totalHours,
        avgHoursPerMember,
        avgHoursPerActiveLearner,
        completions: passed,
        passRate,
        efficiencyScore,
      };
    });

    rawTeamRows.sort(
      (a, b) => b.efficiencyScore - a.efficiencyScore || b.totalHours - a.totalHours
    );
    const rankings = rawTeamRows.map((r, i) => ({ ...r, rank: i + 1 }));

    const activeTeamRankings = rankings.filter((r) => r.member_count > 0);
    const orgAvgHoursPerMember =
      activeTeamRankings.length > 0
        ? Math.round(
            (activeTeamRankings.reduce((s, r) => s + r.avgHoursPerMember, 0) /
              activeTeamRankings.length) *
              10
          ) / 10
        : 0;
    const orgAvgAdoptionRate =
      activeTeamRankings.length > 0
        ? Math.round(
            activeTeamRankings.reduce((s, r) => s + r.participationRate, 0) /
              activeTeamRankings.length
          )
        : 0;
    const teamsWithCompletions = rankings.filter((r) => r.completions > 0);
    const orgAvgPassRate =
      teamsWithCompletions.length > 0
        ? Math.round(
            teamsWithCompletions.reduce((s, r) => s + r.passRate, 0) /
              teamsWithCompletions.length
          )
        : 0;

    // Friction Labs
    const labMap = new Map<
      string,
      {
        name: string;
        content_id: string;
        attempts: number;
        minutesSum: number;
        scoreSum: number;
        scoreCount: number;
        failCount: number;
      }
    >();

    for (const a of activities) {
      if (a['Activity Type'] !== 'Lab') continue;
      const id = a['Content ID'] || a.Activity;
      let l = labMap.get(id);
      if (!l) {
        l = {
          name: a.Activity,
          content_id: a['Content ID'],
          attempts: 0,
          minutesSum: 0,
          scoreSum: 0,
          scoreCount: 0,
          failCount: 0,
        };
        labMap.set(id, l);
      }
      l.attempts += 1;
      l.minutesSum += Number(a['Learning time (minutes)']) || 0;
      if (a.Passed === 'false') l.failCount += 1;
      const g = parseFloat(a['Given Score']);
      const m = parseFloat(a['Maximum Score']);
      if (!isNaN(g) && m > 0) {
        l.scoreSum += (g / m) * 100;
        l.scoreCount += 1;
      }
    }

    const frictionLabs = Array.from(labMap.values())
      .filter((l) => l.attempts >= 2)
      .map((l) => {
        const avgActualMinutes = l.attempts > 0 ? Math.round(l.minutesSum / l.attempts) : 0;
        const catalogDur = idx.catalogById.get(l.content_id)?.duration ?? null;
        const avgScore = l.scoreCount > 0 ? Math.round(l.scoreSum / l.scoreCount) : 100;
        const failRatio = l.attempts > 0 ? l.failCount / l.attempts : 0;

        let frictionLevel: 'Alta' | 'Media' | 'Baja' = 'Baja';
        if (
          failRatio >= 0.45 ||
          avgActualMinutes >= 75 ||
          (catalogDur && avgActualMinutes > catalogDur * 1.4)
        ) {
          frictionLevel = 'Alta';
        } else if (l.failCount > 0 || avgActualMinutes >= 45) {
          frictionLevel = 'Media';
        }

        return {
          name: l.name,
          content_id: l.content_id,
          attempts: l.attempts,
          avgActualMinutes,
          catalogDurationMinutes: catalogDur,
          avgScore,
          failCount: l.failCount,
          frictionLevel,
        };
      })
      .sort((a, b) => {
        const order = { Alta: 0, Media: 1, Baja: 2 };
        if (order[a.frictionLevel] !== order[b.frictionLevel]) {
          return order[a.frictionLevel] - order[b.frictionLevel];
        }
        return b.failCount - a.failCount || b.avgActualMinutes - a.avgActualMinutes;
      })
      .slice(0, 10);

    const result: BenchmarkingStats = {
      orgAvgHoursPerMember,
      orgAvgAdoptionRate,
      orgAvgPassRate,
      rankings,
      frictionLabs,
    };

    this.analyticsCache.set('benchmarking', result);
    return result;
  }

  // ==========================================
  // DASHBOARD 5: QUARTERLY GOALS / OKRs
  // ==========================================
  public async computeGoalsProgress(): Promise<GoalsAndOkrsResponse> {
    const goals = await this.getGoals();
    const adoption = await this.computeAdoptionStats();
    const teamsStats = await this.computeTeamStats();
    const data = this.getData();
    const idx = this.getIndex();
    const allActivities = data.activities;

    const evaluated = goals.map((cfg) => {
      let team_name = 'Toda la Organización';
      let member_count = adoption.totalSeats;
      let currentHoursPerMember = 0;
      let currentAdoptionRate = adoption.activationRate;
      let relevantActivities = allActivities;

      if (cfg.team_slug === 'org-all') {
        const totalMins = allActivities.reduce(
          (s, a) => s + (Number(a['Learning time (minutes)']) || 0),
          0
        );
        const totalHrs = totalMins / 60;
        currentHoursPerMember =
          member_count > 0 ? Math.round((totalHrs / member_count) * 10) / 10 : 0;
      } else {
        const tStat = teamsStats.find((t) => t.team_slug === cfg.team_slug);
        const tAdopt = adoption.teamAdoption.find((t) => t.team_slug === cfg.team_slug);
        team_name = tStat?.name || cfg.team_slug;
        member_count = tStat?.member_count || 0;
        currentHoursPerMember = tStat?.avgHoursPerMember || 0;
        currentAdoptionRate = tAdopt?.adoptionRate || 0;
        relevantActivities = idx.activitiesByTeamSlug.get(cfg.team_slug) || [];
      }

      const hoursProgressPct =
        cfg.targetHoursPerMember > 0
          ? Math.min(100, Math.round((currentHoursPerMember / cfg.targetHoursPerMember) * 100))
          : 100;

      const adoptionProgressPct =
        cfg.targetAdoptionRate > 0
          ? Math.min(100, Math.round((currentAdoptionRate / cfg.targetAdoptionRate) * 100))
          : 100;

      let currentCategoryCompletions = 0;
      let categoryProgressPct = 100;
      if (
        cfg.targetCategory &&
        cfg.targetCategoryCompletions &&
        cfg.targetCategoryCompletions > 0
      ) {
        currentCategoryCompletions = relevantActivities.filter(
          (a) =>
            isSuccessfulCompletion(a) &&
            (a.category || 'Cloud Infrastructure') === cfg.targetCategory
        ).length;
        categoryProgressPct = Math.min(
          100,
          Math.round((currentCategoryCompletions / cfg.targetCategoryCompletions) * 100)
        );
      }

      const overallOkrScore =
        cfg.targetCategory && cfg.targetCategoryCompletions
          ? Math.round(
              hoursProgressPct * 0.4 + adoptionProgressPct * 0.35 + categoryProgressPct * 0.25
            )
          : Math.round(hoursProgressPct * 0.55 + adoptionProgressPct * 0.45);

      let status: 'Cumplido' | 'En Camino' | 'En Riesgo' | 'Atrasado' = 'Atrasado';
      if (overallOkrScore >= 100) status = 'Cumplido';
      else if (overallOkrScore >= 65) status = 'En Camino';
      else if (overallOkrScore >= 35) status = 'En Riesgo';

      return {
        config: cfg,
        team_name,
        member_count,
        currentHoursPerMember,
        hoursProgressPct,
        currentAdoptionRate,
        adoptionProgressPct,
        currentCategoryCompletions,
        categoryProgressPct,
        overallOkrScore,
        status,
      };
    });

    return { goals: evaluated };
  }

  // ==========================================
  // DASHBOARD 6: SAVED CURRICULA PERSISTENCE
  // ==========================================
  public async getCurricula(): Promise<CurriculumPlan[]> {
    const data = this.getData();
    return data.curricula || [];
  }

  public async saveCurriculum(plan: CurriculumPlan): Promise<CurriculumPlan[]> {
    const data = this.getData();
    if (!data.curricula) data.curricula = [];
    data.curricula = [plan, ...data.curricula.filter((c) => c.id !== plan.id)].slice(0, 20);
    this.persist();
    const rt = getRuntimeStorageConfig();
    if (rt.storageBackend === 'bigquery' && rt.bqProjectId) {
      await upsertCurriculumInBigQuery(plan).catch((err) =>
        console.error('⚠️ [BigQuery] Error guardando ruta curricular IA:', err)
      );
    }
    return data.curricula;
  }

  public async deleteCurriculum(id: string): Promise<CurriculumPlan[]> {
    const data = this.getData();
    if (!data.curricula) return [];
    data.curricula = data.curricula.filter((c) => c.id !== id);
    this.persist();
    const rt = getRuntimeStorageConfig();
    if (rt.storageBackend === 'bigquery' && rt.bqProjectId) {
      await deleteCurriculumInBigQuery(id).catch((err) =>
        console.error('⚠️ [BigQuery] Error eliminando ruta curricular IA:', err)
      );
    }
    return data.curricula;
  }

  // ==========================================
  // DASHBOARD 7: NUDGE & ENGAGEMENT SEGMENTS
  // ==========================================
  public async computeNudgeSegments(): Promise<NudgeSegmentSummary[]> {
    const adoption = await this.computeAdoptionStats();
    const certs = await this.computeCertificationStats();
    const catalog = await this.getCatalog();

    const introLab =
      catalog.find((c) => c.content_type === 'Lab' && c.level === 'introductory' && c.url) ||
      catalog[0] || {
        name: 'Google Cloud Fundamentals: Core Infrastructure',
        url: 'https://www.skills.google/catalog',
        duration: 30,
      };

    const advLab =
      catalog.find((c) => c.category === 'AI & Machine Learning' && c.url) || introLab;

    const inactiveRosterMembers = adoption.memberStatuses.filter(
      (m) => m.riskStatus === 'Sin Uso'
    );
    const atRiskMembers = adoption.memberStatuses.filter((m) => m.riskStatus === 'En Riesgo');
    const voucherReady = certs.voucherCandidates.filter(
      (c) => c.status === 'Listo para Voucher' || c.readinessScore >= 65
    );
    const highPerformers = adoption.memberStatuses
      .filter((m) => m.activitiesCompleted >= 5)
      .sort((a, b) => b.activitiesCompleted - a.activitiesCompleted || b.hoursSpent - a.hoursSpent);

    return [
      {
        id: 'inactive_zero',
        title: 'Licencias Sin Actividad (0 Horas)',
        subtitle:
          adoption.unidentifiedInactiveSeats > 0
            ? `${adoption.zeroActivityCount} licencias sin uso (${inactiveRosterMembers.length} identificadas en equipos + ${adoption.unidentifiedInactiveSeats} en padrón general)`
            : 'Colaboradores con asiento asignado que aún no inician su primer módulo',
        count: adoption.zeroActivityCount,
        sampleRecipients: inactiveRosterMembers.slice(0, 15).map((m) => ({
          name: m.name,
          email: m.email,
          team_name: m.team_name,
          detail: '0 módulos iniciados',
        })),
        suggestedStarterLab: {
          name: introLab.name,
          url: introLab.url,
          durationMinutes: introLab.duration || 30,
        },
      },
      {
        id: 'at_risk_30d',
        title: 'Usuarios en Riesgo (+30 Días Inactivos)',
        subtitle: 'Iniciaron capacitación anteriormente pero perdieron ritmo recientemente',
        count: adoption.atRiskCount,
        sampleRecipients: atRiskMembers.slice(0, 15).map((m) => ({
          name: m.name,
          email: m.email,
          team_name: m.team_name,
          detail: `Última vez hace ${m.daysSinceLastActivity} días (${m.hoursSpent}h)`,
        })),
        suggestedStarterLab: {
          name: advLab.name,
          url: advLab.url,
          durationMinutes: advLab.duration || 45,
        },
      },
      {
        id: 'voucher_ready',
        title: 'Candidatos a Certificación Oficial',
        subtitle: 'Talento con alto avance en ruta oficial listo para agendar examen Google Cloud',
        count: certs.certificationReadyCount || voucherReady.length,
        sampleRecipients: voucherReady.slice(0, 15).map((c) => ({
          name: c.name,
          email: c.email,
          team_name: c.team_name,
          detail: `${c.readinessScore}% listo — ${c.targetTrack}`,
        })),
        suggestedStarterLab: {
          name: 'Guía Oficial de Preparación para Certificación Google Cloud',
          url: 'https://cloud.google.com/learn/certification',
          durationMinutes: 60,
        },
      },
      {
        id: 'high_performers',
        title: 'Campeones Cloud & Alto Desempeño',
        subtitle:
          'Estudiantes destacados (≥ 5 módulos aprobados) ideales para reconocer o invitar como mentores',
        count: highPerformers.length,
        sampleRecipients: highPerformers.slice(0, 15).map((m) => ({
          name: m.name,
          email: m.email,
          team_name: m.team_name,
          detail: `${m.activitiesCompleted} aprobados (${m.hoursSpent} hrs)`,
        })),
        suggestedStarterLab: {
          name: advLab.name,
          url: advLab.url,
          durationMinutes: 45,
        },
      },
    ];
  }

  // ==========================================
  // DASHBOARD 8: INTERNAL TALENT FINDER & SME DIRECTORY
  // ==========================================
  public async searchInternalTalent(queryStr = ''): Promise<TalentDirectoryResponse> {
    const cacheKey = `talent:${queryStr.toLowerCase().trim()}`;
    if (this.analyticsCache.has(cacheKey)) return this.analyticsCache.get(cacheKey);

    const data = this.getData();
    const idx = this.getIndex();
    const completedActs = data.activities.filter(isSuccessfulCompletion);

    const SKILL_KEYWORDS = [
      'BigQuery',
      'Looker',
      'Vertex AI',
      'Generative AI',
      'Kubernetes',
      'Cloud SQL',
      'Cloud Storage',
      'IAM & Security',
      'AppSheet',
      'Compute Engine',
      'Networking / VPC',
      'Terraform / DevOps',
    ];

    const matchesKeyword = (act: LearningActivity, kw: string): boolean => {
      const q = kw.toLowerCase().trim();
      if (!q) return true;
      const haystack = `${act.Activity || ''} ${act['Parent Name'] || ''} ${
        act.category || ''
      } ${act['Content ID'] || ''}`.toLowerCase();
      if (q === 'iam & security')
        return (
          haystack.includes('iam') ||
          haystack.includes('security') ||
          haystack.includes('seguridad')
        );
      if (q === 'networking / vpc')
        return (
          haystack.includes('vpc') ||
          haystack.includes('network') ||
          haystack.includes('load balanc')
        );
      if (q === 'terraform / devops')
        return (
          haystack.includes('terraform') ||
          haystack.includes('devops') ||
          haystack.includes('sre') ||
          haystack.includes('monitoring') ||
          haystack.includes('deploy')
        );
      return haystack.includes(q);
    };

    const popularSkills = SKILL_KEYWORDS.map((skill) => {
      const emails = new Set<string>();
      for (const a of completedActs) {
        if (matchesKeyword(a, skill)) emails.add(a.Member.toLowerCase());
      }
      return { skill, expertsCount: emails.size };
    }).sort((a, b) => b.expertsCount - a.expertsCount);

    const learnerGroup = new Map<string, LearningActivity[]>();
    for (const a of completedActs) {
      if (!matchesKeyword(a, queryStr)) continue;
      const lower = a.Member.toLowerCase();
      let list = learnerGroup.get(lower);
      if (!list) {
        list = [];
        learnerGroup.set(lower, list);
      }
      list.push(a);
    }

    const experts: TalentExpert[] = [];

    for (const [lower, acts] of learnerGroup.entries()) {
      const first = acts[0];
      const identity = this.resolveLearnerIdentity(first.Member, first.memberName, first.team_name);

      const passedLabs = acts.filter((a) => a['Activity Type'] === 'Lab').length;
      const mins = acts.reduce((s, a) => s + (Number(a['Learning time (minutes)']) || 0), 0);
      const relevantHours = Math.round((mins / 60) * 10) / 10;

      let scoreSum = 0;
      let scoreCnt = 0;
      for (const a of acts) {
        const g = parseFloat(a['Given Score']);
        const mx = parseFloat(a['Maximum Score']);
        if (!isNaN(g) && mx > 0) {
          scoreSum += (g / mx) * 100;
          scoreCnt++;
        }
      }
      const avgScore = scoreCnt > 0 ? Math.round(scoreSum / scoreCnt) : 100;

      const allUserActs = (idx.activitiesByEmail.get(lower) || []).filter(isSuccessfulCompletion);
      const topSkills = SKILL_KEYWORDS.filter((sk) =>
        allUserActs.some((ua) => matchesKeyword(ua, sk))
      ).slice(0, 5);
      if (topSkills.length === 0) {
        const cats = Array.from(
          new Set(acts.map((a) => a.category || 'Cloud Infrastructure'))
        );
        topSkills.push(...cats.slice(0, 3));
      }

      let championTier: TalentExpert['championTier'] = 'Practicante Bronce';
      if (acts.length >= 10 || relevantHours >= 12) {
        championTier = 'Champion Oro';
      } else if (acts.length >= 4 || relevantHours >= 4) {
        championTier = 'Especialista Plata';
      }

      experts.push({
        email: first.Member,
        name: identity.name,
        team_name: identity.team_name,
        championTier,
        matchingModulesCount: acts.length,
        passedLabsCount: passedLabs,
        avgScore,
        relevantHours,
        topSkills,
        verifiedActivities: acts.slice(0, 5).map((a) => ({
          name: a.Activity,
          type: a['Activity Type'],
          score:
            a['Maximum Score'] && Number(a['Maximum Score']) > 0
              ? `${a['Given Score']}/${a['Maximum Score']}`
              : 'Aprobado',
          completedDate: (a['Date completed'] || '').split(' ')[0],
        })),
      });
    }

    experts.sort(
      (a, b) =>
        b.matchingModulesCount - a.matchingModulesCount || b.relevantHours - a.relevantHours
    );

    const response: TalentDirectoryResponse = {
      query: queryStr,
      popularSkills,
      experts: experts.slice(0, 60),
    };

    this.analyticsCache.set(cacheKey, response);
    return response;
  }

  // ==========================================
  // DASHBOARD 9: GAMIFICATION & ENTERPRISE CLOUD LEAGUE
  // ==========================================
  public async computeGamificationStats(): Promise<GamificationStats> {
    if (this.analyticsCache.has('gamification')) return this.analyticsCache.get('gamification');

    const data = this.getData();
    const effectiveTeams = this.getEffectiveTeamsList();
    const activities = data.activities;

    const playerMap = new Map<
      string,
      {
        email: string;
        name: string;
        team: string;
        team_slug: string;
        points: number;
        labsPassed: number;
        coursesCompleted: number;
        perfectScoresCount: number;
        minutes: number;
        scoreSum: number;
        scoreCnt: number;
        categoriesSet: Set<string>;
      }
    >();

    for (const a of activities) {
      const lower = (a.Member || '').toLowerCase();
      if (!lower) continue;
      let p = playerMap.get(lower);
      if (!p) {
        const identity = this.resolveLearnerIdentity(a.Member, a.memberName, a.team_name);
        p = {
          email: a.Member,
          name: identity.name,
          team: identity.team_name,
          team_slug: identity.team_slug,
          points: 0,
          labsPassed: 0,
          coursesCompleted: 0,
          perfectScoresCount: 0,
          minutes: 0,
          scoreSum: 0,
          scoreCnt: 0,
          categoriesSet: new Set(),
        };
        playerMap.set(lower, p);
      }

      const mins = Number(a['Learning time (minutes)']) || 0;
      p.minutes += mins;
      if (a.category) p.categoriesSet.add(a.category);

      if (isSuccessfulCompletion(a)) {
        if (a['Activity Type'] === 'Lab') {
          p.labsPassed += 1;
          p.points += 150;
        } else {
          p.coursesCompleted += 1;
          p.points += 100;
        }
      } else {
        p.points += 10;
      }

      const g = parseFloat(a['Given Score']);
      const mx = parseFloat(a['Maximum Score']);
      if (!isNaN(g) && mx > 0) {
        const pct = (g / mx) * 100;
        p.scoreSum += pct;
        p.scoreCnt += 1;
        if (pct >= 100 && isSuccessfulCompletion(a)) {
          p.perfectScoresCount += 1;
          p.points += 50;
        }
      }

      p.points += Math.round((mins / 60) * 25);
    }

    const computeBadges = (p: {
      labsPassed: number;
      coursesCompleted: number;
      perfectScoresCount: number;
      minutes: number;
      categoriesSet: Set<string>;
    }): string[] => {
      const badges: string[] = [];
      if (p.labsPassed >= 10) badges.push('⚡ Maestro de Labs');
      if (p.perfectScoresCount >= 5) badges.push('🎯 Precisión 100%');
      if (p.minutes >= 600) badges.push('🔥 Maratonista +10h');
      if (p.categoriesSet.size >= 4) badges.push('🌐 Políglota Cloud');
      if (p.coursesCompleted + p.labsPassed >= 20) badges.push('🏆 Leyenda Cloud');
      if (badges.length === 0) badges.push('🚀 Pionero Cloud');
      return badges;
    };

    const sortedPlayers = Array.from(playerMap.values()).sort((a, b) => b.points - a.points);

    const individualLeague = sortedPlayers.slice(0, 50).map((p, i) => ({
      rank: i + 1,
      name: p.name,
      email: p.email,
      team: p.team,
      points: p.points,
      labsPassed: p.labsPassed,
      coursesCompleted: p.coursesCompleted,
      perfectScoresCount: p.perfectScoresCount,
      badges: computeBadges(p),
    }));

    const teamLeagueRaw = effectiveTeams
      .map((t) => {
        const teamPlayers = sortedPlayers.filter((p) => p.team_slug === t.slug);
        const denom = Math.max(t.member_count || 1, teamPlayers.length, 1);
        const totalPoints = teamPlayers.reduce((s, p) => s + p.points, 0);
        const badgesCount = teamPlayers.reduce((s, p) => s + computeBadges(p).length, 0);
        return {
          team_name: t.name,
          totalPoints,
          avgPointsPerMember: Math.round(totalPoints / denom),
          activeMembers: teamPlayers.length,
          badgesCount,
        };
      })
      .sort(
        (a, b) => b.totalPoints - a.totalPoints || b.avgPointsPerMember - a.avgPointsPerMember
      );

    const teamLeague = teamLeagueRaw.map((t, i) => ({
      rank: i + 1,
      team_name: t.team_name,
      totalPoints: t.totalPoints,
      avgPointsPerMember: t.avgPointsPerMember,
      badgesCount: t.badgesCount,
    }));

    const topLearner = sortedPlayers[0] || null;
    const topLabPlayer =
      [...sortedPlayers].sort((a, b) => b.labsPassed - a.labsPassed || b.points - a.points)[0] ||
      null;
    const topTeam = teamLeagueRaw[0] || null;

    const result: GamificationStats = {
      sprintName: 'Liga Corporativa Cloud & GenAI',
      sprintPeriod: 'Clasificación Histórica y Temporada 2026',
      hallOfFame: {
        learnerOfTheMonth: topLearner
          ? {
              name: topLearner.name,
              email: topLearner.email,
              team: topLearner.team,
              points: topLearner.points,
              hours: Math.round((topLearner.minutes / 60) * 10) / 10,
              badges: computeBadges(topLearner),
            }
          : null,
        fastestTeam: topTeam
          ? {
              team_name: topTeam.team_name,
              points: topTeam.totalPoints,
              avgPointsPerMember: topTeam.avgPointsPerMember,
              activeMembers: topTeam.activeMembers,
            }
          : null,
        labMaster: topLabPlayer
          ? {
              name: topLabPlayer.name,
              email: topLabPlayer.email,
              team: topLabPlayer.team,
              labsPassed: topLabPlayer.labsPassed,
              avgScore:
                topLabPlayer.scoreCnt > 0
                  ? Math.round(topLabPlayer.scoreSum / topLabPlayer.scoreCnt)
                  : 100,
            }
          : null,
      },
      individualLeague,
      teamLeague,
    };

    this.analyticsCache.set('gamification', result);
    return result;
  }

  // ==========================================
  // DASHBOARD 10: LEARNING PULSE & STUDY HABITS HEATMAP
  // ==========================================
  public async computeLearningPulse(): Promise<LearningPulseStats> {
    if (this.analyticsCache.has('pulse')) return this.analyticsCache.get('pulse');

    const data = this.getData();
    const activities = data.activities;

    const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const HOUR_BLOCKS = [
      '00:00 - 04:00',
      '04:00 - 08:00',
      '08:00 - 12:00',
      '12:00 - 16:00',
      '16:00 - 20:00',
      '20:00 - 24:00',
    ];

    const gridCounts: number[][] = DAYS.map(() => HOUR_BLOCKS.map(() => 0));
    const dayMinutes: number[] = DAYS.map(() => 0);
    const dayCounts: number[] = DAYS.map(() => 0);

    let totalValid = 0;
    let workHoursCount = 0;
    let weekendCount = 0;
    let totalMinutes = 0;

    for (const a of activities) {
      const rawDate = a['Date started'] || a['Date completed'];
      if (!rawDate) continue;
      const utcDate = new Date(rawDate);
      if (isNaN(utcDate.getTime())) continue;

      const utcOffsetHours =
        process.env.CORPORATE_UTC_OFFSET !== undefined
          ? Number(process.env.CORPORATE_UTC_OFFSET) || 0
          : 0;
      const localMs = utcDate.getTime() + utcOffsetHours * 60 * 60 * 1000;
      const localDate = new Date(localMs);

      const jsDay = localDate.getUTCDay();
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
      const hour = localDate.getUTCHours();
      const blockIdx = Math.min(5, Math.floor(hour / 4));

      gridCounts[dayIdx][blockIdx] += 1;
      dayCounts[dayIdx] += 1;
      const mins = Number(a['Learning time (minutes)']) || 0;
      dayMinutes[dayIdx] += mins;
      totalMinutes += mins;
      totalValid += 1;

      const isWeekend = dayIdx >= 5;
      if (isWeekend) {
        weekendCount += 1;
      } else if (hour >= 8 && hour < 19) {
        workHoursCount += 1;
      }
    }

    let maxCell = 1;
    let peakDayIdx = 0;
    let peakBlockIdx = 2;
    let peakVal = -1;

    for (let d = 0; d < DAYS.length; d++) {
      for (let b = 0; b < HOUR_BLOCKS.length; b++) {
        const val = gridCounts[d][b];
        if (val > maxCell) maxCell = val;
        if (val > peakVal) {
          peakVal = val;
          peakDayIdx = d;
          peakBlockIdx = b;
        }
      }
    }

    const heatmapGrid = DAYS.map((day, dIdx) => ({
      day,
      blocks: HOUR_BLOCKS.map((block, bIdx) => {
        const count = gridCounts[dIdx][bIdx];
        return {
          block,
          count,
          intensity: count > 0 ? Math.max(18, Math.round((count / maxCell) * 100)) : 0,
        };
      }),
    }));

    const dayDistribution = DAYS.map((day, i) => ({
      day,
      count: dayCounts[i],
      hours: Math.round((dayMinutes[i] / 60) * 10) / 10,
    }));

    const denom = totalValid || 1;
    const workHoursPercentage = Math.round((workHoursCount / denom) * 100);
    const weekendPercentage = Math.round((weekendCount / denom) * 100);
    const afterHoursPercentage = Math.max(0, 100 - workHoursPercentage - weekendPercentage);
    const avgSessionMinutes = totalValid > 0 ? Math.round(totalMinutes / totalValid) : 0;

    let policyRecommendation =
      'La mayor parte del estudio ocurre dentro del horario laboral. Mantén bloques protegidos semanales para sostener el ritmo.';
    if (afterHoursPercentage + weekendPercentage >= 35) {
      policyRecommendation = `El ${
        afterHoursPercentage + weekendPercentage
      }% de las sesiones ocurren fuera de horario laboral o en fin de semana. Se recomienda instituir un bloque oficial de "2 Horas de Aprendizaje Protegido" los viernes por la mañana para evitar fatiga y elevar la adopción.`;
    } else if (dayCounts[4] < dayCounts[peakDayIdx] * 0.4) {
      policyRecommendation = `El pico actual se concentra en ${DAYS[peakDayIdx]} (${
        HOUR_BLOCKS[peakBlockIdx]
      }). Institucionalizar "Viernes de Cloud Labs" de ${Math.max(
        45,
        avgSessionMinutes
      )} min permitiría activar a las licencias sin uso sin afectar la operación.`;
    }

    const result: LearningPulseStats = {
      totalTimestampedActivities: totalValid,
      workHoursPercentage,
      afterHoursPercentage,
      weekendPercentage,
      peakDayName: DAYS[peakDayIdx],
      peakHourBlock: HOUR_BLOCKS[peakBlockIdx],
      avgSessionMinutes,
      policyRecommendation,
      dayDistribution,
      hourBlocks: HOUR_BLOCKS,
      heatmapGrid,
    };

    this.analyticsCache.set('pulse', result);
    return result;
  }

  // ==========================================
  // DASHBOARD 11: FINANCIAL SIMULATOR BASELINE
  // ==========================================
  public async computeFinanceBaseline(): Promise<FinanceBaselineStats> {
    const [overall, adoption, certs, bench] = await Promise.all([
      this.computeOverallStats(),
      this.computeAdoptionStats(),
      this.computeCertificationStats(),
      this.computeBenchmarkingStats(),
    ]);

    const advCount = certs.voucherCandidates.filter(
      (c) => c.status === 'En Progreso Avanzado'
    ).length;

    const teamSeatBreakdown = adoption.teamAdoption.map((ta) => {
      const bRow = bench.rankings.find((r) => r.team_slug === ta.team_slug);
      return {
        team_name: ta.team_name,
        totalSeats: ta.totalMembers,
        activeSeats: ta.activeLearners,
        unusedSeats: ta.inactiveLearners,
        hoursTrained: bRow?.totalHours || 0,
      };
    });

    return {
      totalSeats: adoption.totalSeats,
      activeSeats: Math.min(adoption.totalSeats, adoption.learnersWithActivity),
      unusedSeats: adoption.zeroActivityCount,
      totalHoursTrained: overall.totalHoursSpent,
      totalCompletions: overall.totalCompletions,
      voucherReadyCandidates: certs.certificationReadyCount,
      advancedProgressCandidates: advCount,
      teamSeatBreakdown,
    };
  }
}

export const storage = new StorageService();
