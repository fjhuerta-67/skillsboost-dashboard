import React, { useState } from 'react';
import { GoalsAndOkrsResponse, TeamStats } from '../types';
import { translateLabel } from '../lib/i18n';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  Target,
  Plus,
  Trash2,
  Download,
  Sparkles,
  FileText,
  Printer,
  Copy,
  Check,
} from 'lucide-react';

interface GoalsAndReportsDashboardProps {
  goalsData: GoalsAndOkrsResponse | null;
  teams: TeamStats[];
  isLoading: boolean;
  onRefreshGoals: () => void;
  geminiModel: string;
}

const CATEGORIES = [
  '',
  'AI & Machine Learning',
  'Data & Analytics',
  'Cloud Infrastructure',
  'Cloud Security & IAM',
  'Containers & Kubernetes',
  'DevOps & SRE',
];

export const GoalsAndReportsDashboard: React.FC<GoalsAndReportsDashboardProps> = ({
  goalsData,
  teams,
  isLoading,
  onRefreshGoals,
  geminiModel,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [teamSlug, setTeamSlug] = useState('org-all');
  const [targetHours, setTargetHours] = useState(8);
  const [targetAdoption, setTargetAdoption] = useState(70);
  const [targetCategory, setTargetCategory] = useState('AI & Machine Learning');
  const [targetCategoryCompletions, setTargetCategoryCompletions] = useState(15);
  const [quarterLabel, setQuarterLabel] = useState('Q4 2026');
  const [savingGoal, setSavingGoal] = useState(false);

  // Executive AI Report State
  const [generatingReport, setGeneratingReport] = useState(false);
  const [executiveReport, setExecutiveReport] = useState<string | null>(null);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSavingGoal(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          team_slug: teamSlug,
          targetHoursPerMember: targetHours,
          targetAdoptionRate: targetAdoption,
          targetCategory: targetCategory || undefined,
          targetCategoryCompletions: targetCategory ? targetCategoryCompletions : undefined,
          quarterLabel,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTitle('');
        setShowForm(false);
        onRefreshGoals();
      }
    } catch (err) {
      console.error('Error guardando OKR:', err);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      const res = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.ok) {
        onRefreshGoals();
      }
    } catch (err) {
      console.error('Error eliminando OKR:', err);
    }
  };

  const handleGenerateExecutiveReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch('/api/ai/executive-report', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        setExecutiveReport(data.report);
        setReportGeneratedAt(data.generatedAt);
      }
    } catch (err) {
      console.error('Error generando resumen ejecutivo:', err);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleCopyReport = () => {
    if (!executiveReport) return;
    navigator.clipboard.writeText(executiveReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !goalsData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#E8F0FE] border-t-[#1A73E8] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Cargando planificador de OKRs y módulo de reportes ejecutivos...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Quick Export Actions */}
      <div className="google-card p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-l-4 border-l-[#4285F4]">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1967D2] bg-[#E8F0FE] px-2.5 py-0.5 rounded-full">
            Planeación Operativa y Dirección
          </span>
          <h2 className="text-xl font-bold text-[#202124] mt-2">
            Metas Trimestrales (OKRs) y Centro de Reportes Ejecutivos
          </h2>
          <p className="text-xs text-[#5F6368] mt-1">
            Define objetivos medibles por equipo, exporta sábanas oficiales en CSV y genera informes mensuales con {geminiModel}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/csv?type=activities"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-[#F8FAFD] text-[#3C4043] border border-[#DADCE0] text-xs font-medium transition-all shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#1A73E8]" />
            <span>CSV Actividades</span>
          </a>

          <a
            href="/api/export/csv?type=adoption"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-[#F8FAFD] text-[#3C4043] border border-[#DADCE0] text-xs font-medium transition-all shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#1E8E3E]" />
            <span>CSV Adopción Licencias</span>
          </a>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-[#F8FAFD] text-[#3C4043] border border-[#DADCE0] text-xs font-medium transition-all shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#9334E6]" />
            <span>Imprimir / PDF</span>
          </button>

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Meta OKR</span>
          </button>
        </div>
      </div>

      {/* Create OKR Form */}
      {showForm && (
        <form
          onSubmit={handleCreateGoal}
          className="google-card p-6 border border-[#AECBFA] bg-[#F8FAFD] space-y-4"
        >
          <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
            <Target className="w-4 h-4 text-[#1A73E8]" />
            Configurar Nuevo Objetivo Trimestral (OKR)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-[#3C4043] mb-1">
                Título del Objetivo
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Certificar al 80% de Arquitectura en IA Generativa"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-[#DADCE0] rounded-xl px-3.5 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3C4043] mb-1">
                Trimestre / Periodo
              </label>
              <input
                type="text"
                value={quarterLabel}
                onChange={(e) => setQuarterLabel(e.target.value)}
                className="w-full bg-white border border-[#DADCE0] rounded-xl px-3.5 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3C4043] mb-1">
                Alcance (Organización o Equipo)
              </label>
              <select
                value={teamSlug}
                onChange={(e) => setTeamSlug(e.target.value)}
                className="w-full bg-white border border-[#DADCE0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
              >
                <option value="org-all">Toda la Organización</option>
                {teams.map((t) => (
                  <option key={t.team_slug} value={t.team_slug}>
                    {t.name} ({t.member_count} miembros)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3C4043] mb-1">
                Meta: Horas Promedio / Persona
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value))}
                className="w-full bg-white border border-[#DADCE0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3C4043] mb-1">
                Meta: % Adopción Activa
              </label>
              <input
                type="number"
                min={5}
                max={100}
                value={targetAdoption}
                onChange={(e) => setTargetAdoption(Number(e.target.value))}
                className="w-full bg-white border border-[#DADCE0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3C4043] mb-1">
                Dominio Prioritario (Opcional)
              </label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full bg-white border border-[#DADCE0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
              >
                <option value="">Sin dominio específico</option>
                {CATEGORIES.filter(Boolean).map((c) => (
                  <option key={c} value={c}>
                    {translateLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            {targetCategory && (
              <div>
                <label className="block text-[11px] font-semibold text-[#3C4043] mb-1">
                  Meta Módulos Completados en Dominio
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={targetCategoryCompletions}
                  onChange={(e) => setTargetCategoryCompletions(Number(e.target.value))}
                  className="w-full bg-white border border-[#DADCE0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 rounded-full bg-white border border-[#DADCE0] text-[#5F6368] text-xs hover:bg-[#F1F3F4] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingGoal}
              className="px-5 py-1.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {savingGoal ? 'Guardando...' : 'Guardar OKR'}
            </button>
          </div>
        </form>
      )}

      {/* OKR Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {goalsData.goals.map((item, idx) => {
          const { config } = item;
          const topBars = ['#4285F4', '#34A853', '#FBBC04', '#EA4335'];
          return (
            <div
              key={config.id}
              className="google-card p-5 flex flex-col justify-between space-y-5 relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: topBars[idx % topBars.length] }}
              />
              <div className="pt-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC]">
                      {config.quarterLabel}
                    </span>
                    <span
                      className={`ml-2 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        item.status === 'Cumplido'
                          ? 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]'
                          : item.status === 'En Camino'
                          ? 'bg-[#E8F0FE] text-[#1967D2] border-[#D2E3FC]'
                          : item.status === 'En Riesgo'
                          ? 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]'
                          : 'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteGoal(config.id)}
                    title="Eliminar meta"
                    className="text-[#5F6368] hover:text-[#D93025] transition-colors p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="text-sm font-bold text-[#202124] mt-2.5 leading-snug">
                  {config.title}
                </h3>
                <p className="text-[11px] text-[#5F6368] mt-0.5">
                  Alcance: <span className="text-[#202124] font-semibold">{item.team_name}</span> (
                  {item.member_count} integrantes)
                </p>
              </div>

              {/* Key Results Progress Bars */}
              <div className="space-y-3 pt-3 border-t border-[#E8EAED]">
                {/* KR 1: Hours */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#5F6368]">KR1: Horas / Persona</span>
                    <span className="font-mono font-semibold text-[#202124]">
                      {item.currentHoursPerMember} / {config.targetHoursPerMember}h (
                      {item.hoursProgressPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#F1F3F4] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#4285F4] h-full rounded-full transition-all"
                      style={{ width: `${item.hoursProgressPct}%` }}
                    />
                  </div>
                </div>

                {/* KR 2: Adoption */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#5F6368]">KR2: Participación Activa</span>
                    <span className="font-mono font-semibold text-[#202124]">
                      {item.currentAdoptionRate}% / {config.targetAdoptionRate}% (
                      {item.adoptionProgressPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#F1F3F4] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#34A853] h-full rounded-full transition-all"
                      style={{ width: `${item.adoptionProgressPct}%` }}
                    />
                  </div>
                </div>

                {/* KR 3: Category */}
                {config.targetCategory && config.targetCategoryCompletions ? (
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#5F6368] truncate pr-2">
                        KR3: {translateLabel(config.targetCategory)}
                      </span>
                      <span className="font-mono font-semibold text-[#202124] shrink-0">
                        {item.currentCategoryCompletions} / {config.targetCategoryCompletions} mód.
                      </span>
                    </div>
                    <div className="w-full bg-[#F1F3F4] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#9334E6] h-full rounded-full transition-all"
                        style={{ width: `${item.categoryProgressPct}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Score Footer */}
              <div className="pt-3 border-t border-[#E8EAED] flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-[#5F6368] font-bold">
                  Cumplimiento Global OKR
                </span>
                <span className="text-xl font-bold text-[#1A73E8] font-mono">
                  {item.overallOkrScore}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Automated Executive Report Section (Google Gemini) */}
      <div className="google-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E8EAED] pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[#7627BB] bg-[#F3E8FD] px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Síntesis Ejecutiva Automatizada ({geminiModel})</span>
            </div>
            <h3 className="text-lg font-bold text-[#202124] mt-1.5">
              Generador de Reporte Mensual para Dirección y Recursos Humanos
            </h3>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Redacta al instante un informe integral con diagnóstico de ROI de licencias, brechas de habilidades, candidatos a certificación y plan de acción a 30 días.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {executiveReport && (
              <button
                onClick={handleCopyReport}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#202124] text-xs font-medium transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[#1E8E3E]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#5F6368]" />
                )}
                <span>{copied ? 'Copiado' : 'Copiar Markdown'}</span>
              </button>
            )}

            <button
              onClick={handleGenerateExecutiveReport}
              disabled={generatingReport}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#1A73E8] to-[#9334E6] hover:from-[#1557B0] hover:to-[#7627BB] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${generatingReport ? 'animate-spin' : ''}`} />
              <span>
                {generatingReport
                  ? 'Redactando Informe Ejecutivo...'
                  : executiveReport
                  ? 'Regenerar Informe Ejecutivo'
                  : 'Generar Resumen Ejecutivo con IA'}
              </span>
            </button>
          </div>
        </div>

        {generatingReport ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-3 border-[#E8F0FE] border-t-[#1A73E8] rounded-full animate-spin" />
            <p className="text-xs text-[#3C4043] font-medium">
              {geminiModel} está consolidando licencias, matriz de habilidades, certificaciones y OKRs...
            </p>
          </div>
        ) : executiveReport ? (
          <div className="p-6 rounded-2xl bg-[#F8FAFD] border border-[#DADCE0] space-y-3 shadow-2xs">
            {reportGeneratedAt && (
              <div className="flex flex-wrap items-center justify-between text-[11px] text-[#5F6368] font-mono pb-3 border-b border-[#E8EAED]">
                <span className="font-semibold text-[#1967D2]">
                  DOCUMENTO EJECUTIVO — GOOGLE SKILLS FOR ORGANIZATIONS v1.0
                </span>
                <span>Generado: {new Date(reportGeneratedAt).toLocaleString('es-MX')}</span>
              </div>
            )}
            <div className="text-xs sm:text-sm text-[#202124] leading-relaxed font-sans">
              <MarkdownRenderer content={executiveReport} />
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-[#5F6368] text-xs flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 text-[#4285F4]" />
            <span>
              Haz clic en <strong>"Generar Resumen Ejecutivo con IA"</strong> para crear el informe directivo con las métricas actuales.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
