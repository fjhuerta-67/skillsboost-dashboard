export interface ApiConfig {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  organizationSlug: string;
  contractedLicenses?: number;
}

export interface OrganizationOfficialStats {
  accepted_invitations: number;
  pending_invitations: number;
  cumulative_learners: number;
  labs_started: number;
  courses_enrolled: number;
  labs_passed: number;
  courses_completed: number;
  skills_badges_earned: number;
  startDate?: string;
  endDate?: string;
  fetchedAt?: string;
}

export interface CatalogItem {
  content_id: string;
  content_type: 'Lab' | 'Course' | 'Path' | 'Exam' | 'Game' | 'Certification';
  name: string;
  description: string;
  duration: number | null; // minutes
  level: 'introductory' | 'intermediate' | 'advanced' | null;
  available_locales: string[];
  url: string;
  category: string; // e.g. "Cloud Infrastructure", "Data & AI", "Security", "DevOps & SRE"
}

export interface Team {
  name: string;
  slug: string;
  description: string;
  active: boolean;
  member_count?: number;
}

export interface Member {
  first_name: string;
  last_name: string;
  email: string;
  status: 'active' | 'pending' | 'revoked';
  team_slug?: string;
  team_name?: string;
}

export interface LearningActivity {
  id?: string;
  Member: string; // email
  Activity: string; // name
  'Activity Type': 'Lab' | 'Course' | 'Exam' | 'Game' | 'Certification' | 'Path';
  Passed: 'true' | 'false';
  'Given Score': string;
  'Maximum Score': string;
  'Date started': string;
  'Date completed': string;
  'Content ID': string;
  'Learning time (minutes)': number;
  'Content Url'?: string;
  'Parent Type'?: string;
  'Parent Name'?: string;
  // Enriched fields
  category?: string;
  team_slug?: string;
  team_name?: string;
  memberName?: string;
}

export interface OverallStats {
  totalTrainingsTaken: number;
  totalCompletions: number;
  totalPassed: number;
  passRate: number;
  totalHoursSpent: number;
  avgHoursPerPerson: number;
  totalActiveLearners: number;
  currentYearLabel?: string;
  currentYearActiveLearners?: number;
  unusedCurrentSeats?: number;
  estimatedRotatedSeats?: number;
  skillsBadgesEarned?: number;
  officialLabsPassed?: number;
  officialCoursesCompleted?: number;
  officialAcceptedInvitations?: number;
  officialPendingInvitations?: number;
  contractedLicenses?: number;
  topLearners: {
    email: string;
    name: string;
    team: string;
    completedCount: number;
    passedCount: number;
    hoursSpent: number;
  }[];
  mostPopularTrainings: {
    name: string;
    content_id: string;
    type: string;
    takenCount: number;
    completedCount: number;
    avgScore: number;
  }[];
  activityTypeBreakdown: {
    type: string;
    count: number;
    hours: number;
  }[];
  activityTimeline: {
    date: string;
    completions: number;
    hours: number;
  }[];
}

export interface TeamStats {
  team_slug: string;
  name: string;
  description: string;
  member_count: number;
  trainingsTaken: number;
  trainingsCompleted: number;
  completionRate: number;
  totalHours: number;
  avgHoursPerMember: number;
  focusDistribution: {
    category: string;
    count: number;
    hours: number;
    percentage: number;
  }[];
  mostPopularTrainings: {
    name: string;
    type: string;
    takenCount: number;
  }[];
  top10Members: {
    email: string;
    name: string;
    completedCount: number;
    hoursSpent: number;
  }[];
}

export interface MemberDrilldown {
  email: string;
  name: string;
  team_slug: string;
  team_name: string;
  totalActivities: number;
  completedActivities: number;
  totalHours: number;
  passRate: number;
  categories: {
    category: string;
    count: number;
    hours: number;
  }[];
  activities: LearningActivity[];
}

// ==========================================
// NEW STRATEGIC DASHBOARD TYPES
// ==========================================

// 1. Adoption, Licenses & Retention (ROI)
export interface AdoptionStats {
  currentYearLabel: string;
  totalSeats: number;
  contractedLicenses: number;
  unidentifiedInactiveSeats: number;
  activeLast12Months: number;
  activeLast30Days: number;
  invitedStatusCounts: {
    active: number;
    pending: number;
    revoked: number;
  };
  learnersWithActivity: number; // active in current contract year
  recurringLearners: number; // >= 3 activities in current contract year
  zeroActivityCount: number; // contracted seats unused in current contract year
  atRiskCount: number; // active in current contract year, > 30 days since last activity
  activationRate: number; // % of contracted seats used in current contract year
  overallDropOffRate: number; // % of started activities not completed
  funnel: {
    stage: string;
    count: number;
    percentage: number;
  }[];
  historicalSummary: {
    periodLabel: string;
    totalInvitationsSent: number;
    acceptedInvitationsAllTime: number;
    pendingInvitations: number;
    estimatedRotatedSeats: number;
    historicalLearnersWithActivity: number;
    priorCohortsInactiveThisYear: number;
    historicalRecurringLearners: number;
    funnel: {
      stage: string;
      count: number;
      percentage: number;
    }[];
  };
  teamAdoption: {
    team_slug: string;
    team_name: string;
    totalMembers: number;
    activeLearners: number;
    inactiveLearners: number;
    adoptionRate: number;
  }[];
  memberStatuses: {
    email: string;
    name: string;
    team_name: string;
    inviteStatus: string;
    activitiesStarted: number;
    activitiesCompleted: number;
    hoursSpent: number;
    lastActivityDate: string | null;
    daysSinceLastActivity: number | null;
    riskStatus: 'Activo' | 'En Riesgo' | 'Sin Uso' | 'Cohorte Previa';
  }[];
  dropOffCourses: {
    name: string;
    type: string;
    startedCount: number;
    completedCount: number;
    abandonedCount: number;
    dropOffRate: number;
  }[];
}

// 2. Skill Gap Matrix & Technical Maturity
export interface SkillMatrixStats {
  categories: string[];
  heatmapRows: {
    team_slug: string;
    team_name: string;
    member_count: number;
    totalHours: number;
    cells: {
      category: string;
      count: number;
      hours: number;
      intensity: number; // 0 to 100 normalized
    }[];
  }[];
  categoryTotals: {
    category: string;
    count: number;
    hours: number;
    teamsCovered: number;
    totalTeams: number;
    coverageRate: number;
  }[];
  levelDistribution: {
    level: string;
    count: number;
    hours: number;
    percentage: number;
  }[];
  criticalGaps: {
    team_name: string;
    missingCategories: string[];
  }[];
}

// 3. Learning Paths, Skill Badges & Certification Readiness
export interface CertificationStats {
  totalPathsTracked: number;
  totalActivitiesInPaths: number;
  certificationReadyCount: number;
  pathsOverview: {
    pathName: string;
    parentType: string;
    isOfficialCertTrack: boolean;
    category: string;
    learnersEnrolled: number;
    activitiesCompleted: number;
    totalHours: number;
    avgScore: number;
  }[];
  voucherCandidates: {
    email: string;
    name: string;
    team_name: string;
    targetTrack: string;
    completedModules: number;
    passedModules: number;
    avgScore: number;
    hoursSpent: number;
    readinessScore: number; // 0 - 100
    status: 'Listo para Voucher' | 'En Progreso Avanzado' | 'Inicial';
  }[];
}

// 4. Executive Team Benchmarking
export interface BenchmarkingStats {
  orgAvgHoursPerMember: number;
  orgAvgAdoptionRate: number;
  orgAvgPassRate: number;
  rankings: {
    rank: number;
    team_slug: string;
    team_name: string;
    member_count: number;
    activeLearners: number;
    participationRate: number;
    totalHours: number;
    avgHoursPerMember: number;
    avgHoursPerActiveLearner: number;
    completions: number;
    passRate: number;
    efficiencyScore: number; // Composite index 0-100
  }[];
  frictionLabs: {
    name: string;
    content_id: string;
    attempts: number;
    avgActualMinutes: number;
    catalogDurationMinutes: number | null;
    avgScore: number;
    failCount: number;
    frictionLevel: 'Alta' | 'Media' | 'Baja';
  }[];
}

// 5. Quarterly OKRs & Goals Planner
export interface TeamGoalConfig {
  id: string;
  team_slug: string; // 'org-all' for whole org or team slug
  title: string;
  targetHoursPerMember: number;
  targetAdoptionRate: number;
  targetCategory?: string; // Optional category focus goal
  targetCategoryCompletions?: number;
  quarterLabel: string;
}

export interface GoalsAndOkrsResponse {
  goals: {
    config: TeamGoalConfig;
    team_name: string;
    member_count: number;
    currentHoursPerMember: number;
    hoursProgressPct: number;
    currentAdoptionRate: number;
    adoptionProgressPct: number;
    currentCategoryCompletions: number;
    categoryProgressPct: number;
    overallOkrScore: number; // 0 - 100
    status: 'Cumplido' | 'En Camino' | 'En Riesgo' | 'Atrasado';
  }[];
}

export interface SyncStatus {
  lastSyncAt: string | null;
  mode: 'live' | 'demo';
  status: 'idle' | 'syncing' | 'error' | 'success';
  message: string;
  counts: {
    catalog: number;
    teams: number;
    members: number;
    activities: number;
  };
}

export interface AIQueryRequest {
  query: string;
  history?: { role: 'user' | 'model'; parts: { text: string }[] }[];
}

export interface AIQueryResponse {
  answer: string;
  advisorRole?: string;
  toolCallsExecuted?: string[];
  metricsContext?: Record<string, unknown>;
  recommendations?: {
    title: string;
    type: string;
    url?: string;
    reason: string;
  }[];
}

export interface MemberAISummary {
  email: string;
  name: string;
  assignedProfileRole: string;
  maturityLevel: 'Inicial' | 'Intermedio' | 'Avanzado' | 'Champion Cloud';
  primaryKnowledgeArea: string;
  secondarySkills: string[];
  studySummaryMarkdown: string;
  certificationAssessment: {
    isEligible: boolean;
    statusLabel: 'Apto para Certificación' | 'En Preparación Avanzada' | 'Etapa Fundacional';
    recommendedCertification: string;
    readinessScore: number;
    rationaleMarkdown: string;
  };
  progressionStepsMarkdown: string[];
  recommendedCatalogItems: {
    name: string;
    type: string;
    category: string;
    level: string;
    url: string;
    reason: string;
  }[];
  generatedByModel: string;
  generatedAt: string;
}

// ==========================================
// NEXT-GENERATION LXP & TALENT MODULES (6-11)
// ==========================================

// 6. AI Curriculum Builder
export interface CurriculumWeekModule {
  content_id: string;
  name: string;
  content_type: string;
  level: string;
  category: string;
  estimatedMinutes: number;
  url: string;
  objective: string;
}

export interface CurriculumWeek {
  weekNumber: number;
  theme: string;
  totalMinutes: number;
  modules: CurriculumWeekModule[];
}

export interface CurriculumPlan {
  id: string;
  targetRole: string;
  team_slug: string;
  team_name: string;
  weeksCount: number;
  hoursPerWeek: number;
  detectedGapsAddressed: string[];
  executiveSummary: string;
  weeks: CurriculumWeek[];
  generatedByModel: string;
  createdAt: string;
}

// 7. Nudge & Engagement Campaigns Hub
export type CampaignSegmentId = 'inactive_zero' | 'at_risk_30d' | 'voucher_ready' | 'high_performers';

export interface NudgeSegmentSummary {
  id: CampaignSegmentId;
  title: string;
  subtitle: string;
  count: number;
  sampleRecipients: {
    name: string;
    email: string;
    team_name: string;
    detail: string;
  }[];
  suggestedStarterLab?: {
    name: string;
    url: string;
    durationMinutes: number;
  };
}

export interface NudgeCampaignDraft {
  segmentId: CampaignSegmentId;
  channel: 'email' | 'chat';
  tone: 'ejecutivo' | 'motivacional' | 'urgente';
  subject: string;
  messageBody: string;
  recipientEmails: string[];
  recommendedLabName: string;
  recommendedLabUrl: string;
  generatedByModel: string;
}

// 8. Internal Talent Finder & Cloud Champions Directory
export interface TalentExpert {
  email: string;
  name: string;
  team_name: string;
  championTier: 'Champion Oro' | 'Especialista Plata' | 'Practicante Bronce';
  matchingModulesCount: number;
  passedLabsCount: number;
  avgScore: number;
  relevantHours: number;
  topSkills: string[];
  verifiedActivities: {
    name: string;
    type: string;
    score: string;
    completedDate: string;
  }[];
}

export interface TalentDirectoryResponse {
  query: string;
  popularSkills: { skill: string; expertsCount: number }[];
  experts: TalentExpert[];
}

// 9. Gamification, Leagues & Hall of Fame
export interface GamificationStats {
  sprintName: string;
  sprintPeriod: string;
  hallOfFame: {
    learnerOfTheMonth: {
      name: string;
      email: string;
      team: string;
      points: number;
      hours: number;
      badges: string[];
    } | null;
    fastestTeam: {
      team_name: string;
      points: number;
      avgPointsPerMember: number;
      activeMembers: number;
    } | null;
    labMaster: {
      name: string;
      email: string;
      team: string;
      labsPassed: number;
      avgScore: number;
    } | null;
  };
  individualLeague: {
    rank: number;
    name: string;
    email: string;
    team: string;
    points: number;
    labsPassed: number;
    coursesCompleted: number;
    perfectScoresCount: number;
    badges: string[];
  }[];
  teamLeague: {
    rank: number;
    team_name: string;
    totalPoints: number;
    avgPointsPerMember: number;
    badgesCount: number;
  }[];
}

// 10. Learning Pulse & Study Habits Heatmap
export interface LearningPulseStats {
  totalTimestampedActivities: number;
  workHoursPercentage: number; // Mon-Fri 08:00-19:00 corporate local timezone
  afterHoursPercentage: number;
  weekendPercentage: number;
  peakDayName: string;
  peakHourBlock: string;
  avgSessionMinutes: number;
  policyRecommendation: string;
  // 7 days (Lun..Dom) x 6 4-hour blocks or 24h
  dayDistribution: {
    day: string;
    count: number;
    hours: number;
  }[];
  hourBlocks: string[]; // ['00-04h', '04-08h', '08-12h', '12-16h', '16-20h', '20-24h']
  heatmapGrid: {
    day: string;
    blocks: {
      block: string;
      count: number;
      intensity: number; // 0-100
    }[];
  }[];
}

// 11. Financial Simulator & Budget / Voucher Calculator
export interface FinanceBaselineStats {
  totalSeats: number;
  activeSeats: number;
  unusedSeats: number;
  totalHoursTrained: number;
  totalCompletions: number;
  voucherReadyCandidates: number;
  advancedProgressCandidates: number;
  teamSeatBreakdown: {
    team_name: string;
    totalSeats: number;
    activeSeats: number;
    unusedSeats: number;
    hoursTrained: number;
  }[];
}

