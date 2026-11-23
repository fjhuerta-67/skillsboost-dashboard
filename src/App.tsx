import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { GoogleSkillsLogo } from './components/GoogleSkillsLogo';
import { Navigation, ActiveTab } from './components/Navigation';
import { OverallDashboard } from './components/OverallDashboard';
import { AdoptionDashboard } from './components/AdoptionDashboard';
import { TeamDashboard } from './components/TeamDashboard';
import { BenchmarkingDashboard } from './components/BenchmarkingDashboard';
import { SkillMatrixDashboard } from './components/SkillMatrixDashboard';
import { CertificationDashboard } from './components/CertificationDashboard';
import { CurriculumBuilder } from './components/CurriculumBuilder';
import { NudgeCampaignsHub } from './components/NudgeCampaignsHub';
import { TalentFinderDashboard } from './components/TalentFinderDashboard';
import { GamificationLeague } from './components/GamificationLeague';
import { LearningPulseDashboard } from './components/LearningPulseDashboard';
import { FinancialSimulator } from './components/FinancialSimulator';
import { GoalsAndReportsDashboard } from './components/GoalsAndReportsDashboard';
import { CatalogView } from './components/CatalogView';
import { IntelligenceModule } from './components/IntelligenceModule';
import { SettingsModal } from './components/SettingsModal';
import { HelpCenterModal } from './components/HelpCenterModal';
import {
  OverallStats,
  TeamStats,
  AdoptionStats,
  SkillMatrixStats,
  CertificationStats,
  BenchmarkingStats,
  CurriculumPlan,
  NudgeSegmentSummary,
  TalentDirectoryResponse,
  GamificationStats,
  LearningPulseStats,
  FinanceBaselineStats,
  GoalsAndOkrsResponse,
  CatalogItem,
  SyncStatus,
  ApiConfig,
} from './types';

const VALID_TABS: ActiveTab[] = [
  'overall',
  'adoption',
  'teams',
  'benchmarking',
  'matrix',
  'certifications',
  'curriculum',
  'campaigns',
  'talent',
  'gamification',
  'pulse',
  'finance',
  'goals',
  'catalog',
  'ai',
];

function getInitialTab(): ActiveTab {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace(/^#/, '') as ActiveTab;
    if (VALID_TABS.includes(hash)) {
      return hash;
    }
  }
  return 'overall';
}

export const App: React.FC = () => {
  const [activeTab, setActiveTabState] = useState<ActiveTab>(getInitialTab);

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      const newUrl =
        tab === 'overall'
          ? window.location.pathname + window.location.search
          : `${window.location.pathname}${window.location.search}#${tab}`;
      window.history.replaceState(null, '', newUrl);
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '') as ActiveTab;
      if (VALID_TABS.includes(hash)) {
        setActiveTabState(hash);
      } else if (!window.location.hash) {
        setActiveTabState('overall');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [geminiModel, setGeminiModel] = useState<string>('gemini-2.5-flash');
  const [runtimeInfo, setRuntimeInfo] = useState<{
    env: 'local' | 'cloud';
    storageBackend: 'local' | 'gcs' | 'bigquery';
    gcsBucket?: string | null;
    bqDataset?: string | null;
    geminiAuthMode?: 'api_key' | 'vertex_ai' | 'unconfigured';
    lockSettings?: boolean;
  }>({ env: 'local', storageBackend: 'local' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualsOpen, setIsManualsOpen] = useState(false);

  // Analytics & LXP State across all 15 modules
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [adoptionStats, setAdoptionStats] = useState<AdoptionStats | null>(null);
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [benchmarkingStats, setBenchmarkingStats] = useState<BenchmarkingStats | null>(null);
  const [skillMatrix, setSkillMatrix] = useState<SkillMatrixStats | null>(null);
  const [certificationStats, setCertificationStats] = useState<CertificationStats | null>(null);
  const [savedCurricula, setSavedCurricula] = useState<CurriculumPlan[]>([]);
  const [nudgeSegments, setNudgeSegments] = useState<NudgeSegmentSummary[]>([]);
  const [talentDirectory, setTalentDirectory] = useState<TalentDirectoryResponse | null>(null);
  const [gamificationStats, setGamificationStats] = useState<GamificationStats | null>(null);
  const [learningPulse, setLearningPulse] = useState<LearningPulseStats | null>(null);
  const [financeBaseline, setFinanceBaseline] = useState<FinanceBaselineStats | null>(null);
  const [goalsData, setGoalsData] = useState<GoalsAndOkrsResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Drilldown selection
  const [selectedMemberEmail, setSelectedMemberEmail] = useState<string | null>(null);

  const fetchGoalsOnly = async () => {
    try {
      const res = await fetch('/api/goals').then((r) => r.json());
      if (res.ok) setGoalsData({ goals: res.goals });
    } catch (err) {
      console.error('Failed refreshing goals:', err);
    }
  };

  const fetchCurriculaOnly = async () => {
    try {
      const res = await fetch('/api/curricula').then((r) => r.json());
      if (res.ok) setSavedCurricula(res.curricula || []);
    } catch (err) {
      console.error('Failed refreshing curricula:', err);
    }
  };

  const fetchAllData = async () => {
    try {
      const [
        statusRes,
        overallRes,
        adoptionRes,
        teamsRes,
        benchRes,
        matrixRes,
        certRes,
        curriculaRes,
        segmentsRes,
        talentRes,
        gameRes,
        pulseRes,
        financeRes,
        goalsRes,
        catalogRes,
      ] = await Promise.all([
        fetch('/api/status').then((r) => r.json()),
        fetch('/api/analytics/overall').then((r) => r.json()),
        fetch('/api/analytics/adoption').then((r) => r.json()),
        fetch('/api/analytics/teams').then((r) => r.json()),
        fetch('/api/analytics/benchmarking').then((r) => r.json()),
        fetch('/api/analytics/skill-matrix').then((r) => r.json()),
        fetch('/api/analytics/certifications').then((r) => r.json()),
        fetch('/api/curricula').then((r) => r.json()),
        fetch('/api/campaigns/segments').then((r) => r.json()),
        fetch('/api/analytics/talent').then((r) => r.json()),
        fetch('/api/analytics/gamification').then((r) => r.json()),
        fetch('/api/analytics/learning-pulse').then((r) => r.json()),
        fetch('/api/analytics/finance').then((r) => r.json()),
        fetch('/api/goals').then((r) => r.json()),
        fetch('/api/catalog').then((r) => r.json()),
      ]);

      if (statusRes.ok) {
        setSyncStatus(statusRes.status);
        if (statusRes.geminiModel) setGeminiModel(statusRes.geminiModel);
        if (statusRes.runtime) setRuntimeInfo(statusRes.runtime);
      }
      if (overallRes.ok) setOverallStats(overallRes.stats);
      if (adoptionRes.ok) setAdoptionStats(adoptionRes.adoption);
      if (teamsRes.ok) setTeams(teamsRes.teams);
      if (benchRes.ok) setBenchmarkingStats(benchRes.benchmarking);
      if (matrixRes.ok) setSkillMatrix(matrixRes.matrix);
      if (certRes.ok) setCertificationStats(certRes.certifications);
      if (curriculaRes.ok) setSavedCurricula(curriculaRes.curricula || []);
      if (segmentsRes.ok) setNudgeSegments(segmentsRes.segments || []);
      if (talentRes.ok) setTalentDirectory(talentRes.directory);
      if (gameRes.ok) setGamificationStats(gameRes.gamification);
      if (pulseRes.ok) setLearningPulse(pulseRes.pulse);
      if (financeRes.ok) setFinanceBaseline(financeRes.finance);
      if (goalsRes.ok) setGoalsData({ goals: goalsRes.goals });
      if (catalogRes.ok) setCatalog(catalogRes.catalog);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (!isSyncing && syncStatus?.status !== 'syncing') return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/status').then((r) => r.json());
        if (res.ok && res.status) {
          setSyncStatus(res.status);
          if (!res.isSyncing && res.status.status !== 'syncing') {
            setIsSyncing(false);
            await fetchAllData();
          }
        }
      } catch (err) {
        console.error('Status poll error:', err);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [isSyncing, syncStatus?.status]);

  const handleSync = async (forceDemo = false) => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceDemo }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.status) setSyncStatus(data.status);
        if (!data.async) {
          await fetchAllData();
          setIsSyncing(false);
        }
      } else {
        setIsSyncing(false);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      setIsSyncing(false);
    }
  };

  const handleSelectMember = (email: string) => {
    setSelectedMemberEmail(email);
    setActiveTab('teams');
  };

  const handleSaveSettings = async (config: ApiConfig, triggerSync: boolean) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.ok) {
        if (triggerSync) {
          await handleSync(false);
        } else {
          await fetchAllData();
        }
      }
    } catch (err) {
      console.error('Failed saving API settings:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFD] text-[#202124] google-glow">
      {/* Top Header */}
      <Header
        syncStatus={syncStatus}
        onSync={handleSync}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenManuals={() => setIsManualsOpen(true)}
        isSyncing={isSyncing}
        geminiModel={geminiModel}
        runtimeInfo={runtimeInfo}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        onResetDemo={() => handleSync(true)}
      />

      {/* Interactive Documentation & Manuals Center */}
      <HelpCenterModal
        isOpen={isManualsOpen}
        onClose={() => setIsManualsOpen(false)}
      />

      {/* Module Tabs Navigation */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overall' && (
          <OverallDashboard
            stats={overallStats}
            isLoading={loading}
            onSelectMember={handleSelectMember}
          />
        )}

        {activeTab === 'adoption' && (
          <AdoptionDashboard
            stats={adoptionStats}
            isLoading={loading}
            onSelectMember={handleSelectMember}
          />
        )}

        {activeTab === 'teams' && (
          <TeamDashboard
            teams={teams}
            selectedMemberEmail={selectedMemberEmail}
            onClearSelectedMember={() => setSelectedMemberEmail(null)}
            onSelectMember={setSelectedMemberEmail}
          />
        )}

        {activeTab === 'benchmarking' && (
          <BenchmarkingDashboard
            stats={benchmarkingStats}
            isLoading={loading}
          />
        )}

        {activeTab === 'matrix' && (
          <SkillMatrixDashboard
            matrix={skillMatrix}
            isLoading={loading}
          />
        )}

        {activeTab === 'pulse' && (
          <LearningPulseDashboard
            pulse={learningPulse}
            isLoading={loading}
          />
        )}

        {activeTab === 'certifications' && (
          <CertificationDashboard
            stats={certificationStats}
            isLoading={loading}
            onSelectMember={handleSelectMember}
          />
        )}

        {activeTab === 'curriculum' && (
          <CurriculumBuilder
            teams={teams}
            savedCurricula={savedCurricula}
            isLoading={loading}
            onRefreshCurricula={fetchCurriculaOnly}
            onCurriculaUpdated={setSavedCurricula}
            geminiModel={geminiModel}
          />
        )}

        {activeTab === 'talent' && (
          <TalentFinderDashboard
            initialData={talentDirectory}
            onSelectMember={handleSelectMember}
          />
        )}

        {activeTab === 'campaigns' && (
          <NudgeCampaignsHub
            segments={nudgeSegments}
            isLoading={loading}
            geminiModel={geminiModel}
          />
        )}

        {activeTab === 'gamification' && (
          <GamificationLeague
            stats={gamificationStats}
            isLoading={loading}
            onSelectMember={handleSelectMember}
          />
        )}

        {activeTab === 'finance' && (
          <FinancialSimulator
            baseline={financeBaseline}
            isLoading={loading}
          />
        )}

        {activeTab === 'goals' && (
          <GoalsAndReportsDashboard
            goalsData={goalsData}
            teams={teams}
            isLoading={loading}
            onRefreshGoals={fetchGoalsOnly}
            geminiModel={geminiModel}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogView catalog={catalog} isLoading={loading} />
        )}

        {activeTab === 'ai' && (
          <IntelligenceModule geminiModel={geminiModel} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DADCE0] bg-white mt-8">
        <div className="google-rainbow-bar h-1 w-full opacity-90" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5F6368]">
          <div className="flex items-center gap-3">
            <GoogleSkillsLogo showSubtitle={false} compact />
            <span className="hidden md:inline text-[#DADCE0]">|</span>
            <span className="hidden md:inline text-[#5F6368]">
              Suite Integral de Analítica, Talento e Inteligencia LXP
            </span>
          </div>
          <p className="font-mono text-[11px] text-[#5F6368] bg-[#F1F3F4] px-3 py-1 rounded-full border border-[#E8EAED]">
            15 Módulos Activos • Google Skills API v2 • Google Gemini AI
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
