import { CatalogItem, Team, Member, LearningActivity } from '../types';
import { storage } from './storage';

export interface SkillsApiConfig {
  baseUrl?: string;
  accessKey?: string;
  secretKey?: string;
  organizationSlug?: string;
}

export function formatNameFromEmail(email: string): string {
  if (!email) return 'Colaborador';
  const local = email.split('@')[0] || email;
  const parts = local
    .replace(/[0-9_]+/g, ' ')
    .split(/[.\-\s]+/)
    .filter(Boolean);
  if (parts.length === 0) return email;
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

export class SkillsApiClient {
  private baseUrl: string;
  private accessKey: string;
  private secretKey: string;
  private organizationSlug: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config?: SkillsApiConfig) {
    const stored = storage.getApiConfig();
    this.baseUrl = config?.baseUrl || stored.baseUrl || process.env.SKILLS_API_BASE_URL || 'https://www.skills.google/api/v2';
    this.accessKey = config?.accessKey || stored.accessKey || process.env.SKILLS_ACCESS_KEY || '';
    this.secretKey = config?.secretKey || stored.secretKey || process.env.SKILLS_SECRET_KEY || '';
    this.organizationSlug = config?.organizationSlug || stored.organizationSlug || process.env.SKILLS_ORGANIZATION_SLUG || '';
  }

  public reloadConfig(): void {
    const stored = storage.getApiConfig();
    this.baseUrl = stored.baseUrl || process.env.SKILLS_API_BASE_URL || 'https://www.skills.google/api/v2';
    this.accessKey = stored.accessKey || process.env.SKILLS_ACCESS_KEY || '';
    this.secretKey = stored.secretKey || process.env.SKILLS_SECRET_KEY || '';
    this.organizationSlug = stored.organizationSlug || process.env.SKILLS_ORGANIZATION_SLUG || '';
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  public isConfigured(): boolean {
    this.reloadConfig();
    return Boolean(this.accessKey && this.secretKey && this.organizationSlug);
  }

  /**
   * Generates or returns a valid Bearer Auth Token
   * POST /api/v2/authenticate with x-www-form-urlencoded credentials
   */
  public async getAuthToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    if (!this.accessKey || !this.secretKey) {
      throw new Error('Faltan credenciales de la API de Google Skills: se requieren ACCESS_KEY y SECRET_KEY.');
    }

    const authUrl = `${this.baseUrl}/authenticate`;
    const params = new URLSearchParams();
    params.append('access_key', this.accessKey);
    params.append('secret_key', this.secretKey);

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fallo de autenticación (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const token = data.auth_token || data.token || data.access_token;
    if (!token) {
      throw new Error(`Estructura de autenticación inválida: ${JSON.stringify(data)}`);
    }

    this.cachedToken = token;
    // Tokens are valid for 1 hour; cache for 50 minutes
    this.tokenExpiresAt = now + 50 * 60 * 1000;
    return token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Skills API error ${res.status} [${url}]: ${err}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Fetch Catalog page
   * GET /api/v2/organizations/{slug}/learning_catalog
   */
  public async fetchLearningCatalog(page = 1, perPage = 500): Promise<CatalogItem[]> {
    const endpoint = `/organizations/${this.organizationSlug}/learning_catalog?page=${page}&per_page=${perPage}`;
    const rawItems = await this.request<any[]>(endpoint);
    return (rawItems || []).map((item) => ({
      content_id: item.content_id || item.id || '',
      content_type: item.content_type || 'Course',
      name: item.name || '',
      description: item.description || '',
      duration: item.duration ?? null,
      level: item.level || null,
      available_locales: item.available_locales || ['English'],
      url: item.url || item.content_url || '',
      category: this.classifyCategory(item.name, item.description),
    }));
  }

  /**
   * Fetch all Catalog items paginated
   */
  public async fetchAllCatalogItems(maxPages = 25): Promise<CatalogItem[]> {
    const allItems: CatalogItem[] = [];
    const perPage = 500;
    let page = 1;
    while (page <= maxPages) {
      const items = await this.fetchLearningCatalog(page, perPage);
      if (!items || items.length === 0) break;
      allItems.push(...items);
      if (items.length < perPage) break;
      page++;
    }
    return allItems;
  }

  /**
   * Fetch Teams (single page & all pages)
   * GET /api/v2/organizations/{slug}/teams
   */
  public async fetchTeams(page = 1, perPage = 100): Promise<Team[]> {
    const endpoint = `/organizations/${this.organizationSlug}/teams?page=${page}&per_page=${perPage}`;
    return this.request<Team[]>(endpoint);
  }

  public async fetchAllTeams(maxPages = 20): Promise<Team[]> {
    const allTeams: Team[] = [];
    const perPage = 100;
    let page = 1;
    while (page <= maxPages) {
      const batch = await this.fetchTeams(page, perPage);
      if (!batch || batch.length === 0) break;
      allTeams.push(...batch);
      if (batch.length < perPage) break;
      page++;
    }
    return allTeams;
  }

  /**
   * Fetch Members of a Team (single page & all pages)
   * GET /api/v2/organizations/{slug}/teams/{team_slug}/members
   */
  public async fetchTeamMembers(teamSlug: string, page = 1, perPage = 100): Promise<Member[]> {
    const endpoint = `/organizations/${this.organizationSlug}/teams/${teamSlug}/members?page=${page}&per_page=${perPage}`;
    const members = await this.request<any[]>(endpoint);
    return (members || []).map((m) => ({
      first_name: m.first_name || '',
      last_name: m.last_name || '',
      email: m.email,
      status: m.status || 'active',
      team_slug: teamSlug,
    }));
  }

  public async fetchAllTeamMembers(teamSlug: string, maxPages = 50): Promise<Member[]> {
    const all: Member[] = [];
    const perPage = 100;
    let page = 1;
    while (page <= maxPages) {
      const batch = await this.fetchTeamMembers(teamSlug, page, perPage);
      if (!batch || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < perPage) break;
      page++;
    }
    return all;
  }

  /**
   * Initiates Organization Statistics generation
   * POST /api/v2/organizations/{slug}/stats
   */
  public async triggerOrganizationStats(params: {
    startDate: string;
    endDate: string;
    teamSlug?: string;
  }): Promise<{ code: number; operation_id: number; started_at: string }> {
    const query = new URLSearchParams({
      start_date: params.startDate,
      end_date: params.endDate,
    });
    if (params.teamSlug) {
      query.append('organization_team_slug', params.teamSlug);
    }
    const endpoint = `/organizations/${this.organizationSlug}/stats?${query.toString()}`;
    return this.request<{ code: number; operation_id: number; started_at: string }>(endpoint, {
      method: 'POST',
    });
  }

  /**
   * Initiates asynchronous report generation
   * POST /api/v2/reports/learning_activities
   */
  public async triggerLearningActivitiesReport(params: {
    startDate: string;
    endDate: string;
    teamSlug?: string;
    memberEmail?: string;
  }): Promise<{ code: number; operation_id: number; started_at: string }> {
    const query = new URLSearchParams({
      organization_slug: this.organizationSlug,
      start_date: params.startDate,
      end_date: params.endDate,
    });
    if (params.teamSlug) query.append('organization_team_slug', params.teamSlug);
    if (params.memberEmail) query.append('member_email', params.memberEmail);

    const endpoint = `/reports/learning_activities?${query.toString()}`;
    return this.request<{ code: number; operation_id: number; started_at: string }>(endpoint, {
      method: 'POST',
    });
  }

  /**
   * Polls Operations endpoint until status is done (default up to 15 minutes for large orgs)
   * GET /api/v2/operations/{operation_id}
   */
  public async pollOperation(
    operationId: number | string,
    maxAttempts = 180,
    intervalMs = 5000,
    onProgress?: (attempt: number, elapsedSec: number) => Promise<void> | void
  ): Promise<any> {
    const endpoint = `/operations/${operationId}`;
    const startedMs = Date.now();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await this.request<any>(endpoint);
      if (res.done) {
        if (res.error) {
          throw new Error(`La operación #${operationId} falló: ${JSON.stringify(res.error)}`);
        }
        return res.result;
      }
      if (onProgress && attempt > 0 && attempt % 2 === 0) {
        const elapsedSec = Math.round((Date.now() - startedMs) / 1000);
        await onProgress(attempt, elapsedSec);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(
      `La operación #${operationId} excedió el tiempo límite tras ${Math.round((maxAttempts * intervalMs) / 1000)} segundos.`
    );
  }

  /**
   * Retrieves generated report
   * GET /api/v2/reports/{report_id}
   */
  public async fetchReport(reportId: number | string): Promise<{
    report_id: string;
    report_type: string;
    report_data: LearningActivity[];
  }> {
    const endpoint = `/reports/${reportId}`;
    return this.request<{
      report_id: string;
      report_type: string;
      report_data: LearningActivity[];
    }>(endpoint);
  }

  /**
   * Helper heuristic to categorize courses based on title and description keywords
   */
  public classifyCategory(name: string, description: string): string {
    const text = `${name} ${description}`.toLowerCase();
    if (
      text.includes('generative ai') ||
      text.includes('gemini') ||
      text.includes('machine learning') ||
      text.includes('tensorflow') ||
      text.includes('vertex ai') ||
      text.includes('ai') ||
      text.includes('llm')
    ) {
      return 'AI & Machine Learning';
    }
    if (
      text.includes('bigquery') ||
      text.includes('data') ||
      text.includes('dataproc') ||
      text.includes('dataflow') ||
      text.includes('analytics') ||
      text.includes('sql') ||
      text.includes('looker') ||
      text.includes('lakehouse')
    ) {
      return 'Data & Analytics';
    }
    if (
      text.includes('security') ||
      text.includes('iam') ||
      text.includes('compliance') ||
      text.includes('identity') ||
      text.includes('kms') ||
      text.includes('shield')
    ) {
      return 'Cloud Security & IAM';
    }
    if (
      text.includes('kubernetes') ||
      text.includes('gke') ||
      text.includes('docker') ||
      text.includes('container') ||
      text.includes('cloud run')
    ) {
      return 'Containers & Kubernetes';
    }
    if (
      text.includes('devops') ||
      text.includes('sre') ||
      text.includes('terraform') ||
      text.includes('ci/cd') ||
      text.includes('monitoring') ||
      text.includes('logging') ||
      text.includes('cloud build')
    ) {
      return 'DevOps & SRE';
    }
    return 'Cloud Infrastructure';
  }
}
