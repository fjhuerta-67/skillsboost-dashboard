import React, { useEffect, useState } from 'react';
import { CurriculumPlan, TeamStats } from '../types';
import { translateLabel } from '../lib/i18n';
import {
  Wand2,
  Clock,
  ExternalLink,
  Sparkles,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';

interface CurriculumBuilderProps {
  teams: TeamStats[];
  savedCurricula: CurriculumPlan[];
  isLoading?: boolean;
  onRefreshCurricula: () => void | Promise<void>;
  onCurriculaUpdated?: React.Dispatch<React.SetStateAction<CurriculumPlan[]>>;
  geminiModel: string;
}

const PRESET_ROLES = [
  'Ingeniero de IA Generativa y Vertex AI',
  'Arquitecto de Datos en BigQuery y Looker',
  'Arquitecto Cloud Empresarial (PCA)',
  'Especialista en Seguridad Cloud e IAM',
  'Ingeniero DevOps / SRE en Kubernetes (GKE)',
  'Líder Digital en la Nube (Cloud Digital Leader)',
];

const WEEK_BADGE_COLORS = [
  'bg-[#E8F0FE] text-[#1967D2] border-[#D2E3FC]',
  'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]',
  'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]',
  'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]',
];

export const CurriculumBuilder: React.FC<CurriculumBuilderProps> = ({
  teams,
  savedCurricula,
  isLoading = false,
  onRefreshCurricula,
  onCurriculaUpdated,
  geminiModel,
}) => {
  const [teamSlug, setTeamSlug] = useState<string>('org-all');
  const [targetRole, setTargetRole] = useState<string>(PRESET_ROLES[0]);
  const [weeksCount, setWeeksCount] = useState<number>(4);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(3);
  const [generating, setGenerating] = useState<boolean>(false);
  const [activePlan, setActivePlan] = useState<CurriculumPlan | null>(savedCurricula[0] || null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!activePlan && savedCurricula.length > 0) {
      setActivePlan(savedCurricula[0]);
    }
  }, [savedCurricula, activePlan]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#F3E8FD] border-t-[#9334E6] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Cargando diseñador de rutas curriculares...
        </p>
      </div>
    );
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRole.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamSlug,
          targetRole,
          weeksCount,
          hoursPerWeek,
        }),
      });
      const data = await res.json();
      if (data.ok && data.plan) {
        setActivePlan(data.plan);
        if (onCurriculaUpdated && Array.isArray(data.curricula)) {
          onCurriculaUpdated(data.curricula);
        }
        onRefreshCurricula();
      }
    } catch (err) {
      console.error('Error generando ruta curricular:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/curricula/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        if (onCurriculaUpdated && Array.isArray(data.curricula)) {
          onCurriculaUpdated(data.curricula);
        }
        if (activePlan?.id === id) {
          setActivePlan(data.curricula?.[0] || null);
        }
        onRefreshCurricula();
      }
    } catch (err) {
      console.error('Error eliminando ruta:', err);
    }
  };

  const copyPlanMarkdown = () => {
    if (!activePlan) return;
    const lines = [
      `# Ruta de Aprendizaje: ${activePlan.targetRole}`,
      `Equipo: ${activePlan.team_name} | Duración: ${activePlan.weeksCount} semanas (${activePlan.hoursPerWeek} hrs/semana)`,
      `\n${activePlan.executiveSummary}\n`,
    ];
    for (const w of activePlan.weeks) {
      lines.push(`## Semana ${w.weekNumber}: ${w.theme} (${w.totalMinutes} min)`);
      for (const m of w.modules) {
        lines.push(
          `- [${translateLabel(m.content_type)}] **${m.name}** (${m.estimatedMinutes} min) — ${m.url}`
        );
        lines.push(`  *Objetivo:* ${m.objective}`);
      }
      lines.push('');
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="google-card p-6 border-l-4 border-l-[#9334E6]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#7627BB] bg-[#F3E8FD] px-2.5 py-0.5 rounded-full">
          Arquitectura Curricular Personalizada ({geminiModel})
        </span>
        <h2 className="text-xl font-bold text-[#202124] mt-2">
          Diseñador de Rutas de Aprendizaje con IA sobre el Catálogo Oficial
        </h2>
        <p className="text-xs text-[#5F6368] mt-1">
          Selecciona un equipo, un perfil técnico objetivo y la disponibilidad semanal para construir un plan semana por semana con laboratorios reales.
        </p>
      </div>

      {/* Generator Form */}
      <form onSubmit={handleGenerate} className="google-card p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-[#3C4043] mb-1.5">
              Rol o Competencia Objetivo
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Ej. Arquitecto de Datos en BigQuery..."
              className="w-full bg-white border border-[#DADCE0] rounded-xl px-3.5 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setTargetRole(role)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                    targetRole === role
                      ? 'bg-[#F3E8FD] text-[#7627BB] border-[#D7AEFB] font-semibold'
                      : 'bg-[#F8FAFD] text-[#5F6368] border-[#E8EAED] hover:text-[#202124] hover:bg-[#F1F3F4]'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#3C4043] mb-1.5">
              Equipo Destinatario
            </label>
            <select
              value={teamSlug}
              onChange={(e) => setTeamSlug(e.target.value)}
              className="w-full bg-white border border-[#DADCE0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
            >
              <option value="org-all">Toda la Organización</option>
              {teams.map((t) => (
                <option key={t.team_slug} value={t.team_slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#3C4043] mb-1.5">
                Semanas
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={weeksCount}
                onChange={(e) => setWeeksCount(Number(e.target.value))}
                className="w-full bg-white border border-[#DADCE0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#3C4043] mb-1.5">
                Hrs / Sem
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-full bg-white border border-[#DADCE0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E8EAED]">
          <span className="text-[11px] text-[#5F6368]">
            Cruce automático contra las brechas actuales de la Matriz de Habilidades y los cursos del catálogo.
          </span>
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#1A73E8] to-[#9334E6] hover:from-[#1557B0] hover:to-[#7627BB] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60 cursor-pointer"
          >
            <Wand2 className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            <span>
              {generating ? 'Diseñando Plan Semanal con IA...' : 'Generar Ruta de Aprendizaje'}
            </span>
          </button>
        </div>
      </form>

      {/* Saved Curricula Selector + Active Plan Display */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Saved Plans Sidebar */}
        <div className="google-card p-4 space-y-3 h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5F6368] px-1">
            Rutas Guardadas ({savedCurricula.length})
          </h3>
          {savedCurricula.length === 0 ? (
            <p className="text-xs text-[#5F6368] py-6 text-center">
              Aún no has generado ninguna ruta curricular.
            </p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {savedCurricula.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setActivePlan(c)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-2 ${
                    activePlan?.id === c.id
                      ? 'bg-[#E8F0FE] border-[#AECBFA] text-[#174EA6]'
                      : 'bg-[#F8FAFD] border-[#E8EAED] text-[#3C4043] hover:bg-white hover:border-[#DADCE0]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate text-[#202124]">{c.targetRole}</div>
                    <div className="text-[10px] text-[#5F6368] truncate mt-0.5">{c.team_name}</div>
                    <div className="text-[10px] font-mono font-semibold text-[#9334E6] mt-1">
                      {c.weeksCount} sem • {c.hoursPerWeek}h/sem
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(c.id);
                    }}
                    className="text-[#5F6368] hover:text-[#D93025] p-1 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Active Curriculum Roadmap */}
        <div className="lg:col-span-3 space-y-5">
          {generating ? (
            <div className="google-card p-16 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-3 border-[#F3E8FD] border-t-[#9334E6] rounded-full animate-spin" />
              <p className="text-xs text-[#3C4043] font-medium">
                Seleccionando laboratorios del catálogo de Google Skills y estructurando semanas con{' '}
                {geminiModel}...
              </p>
            </div>
          ) : activePlan ? (
            <div className="google-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-[#E8EAED] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#F3E8FD] text-[#7627BB] border border-[#D7AEFB]">
                      {activePlan.weeksCount} Semanas • {activePlan.hoursPerWeek} hrs/semana
                    </span>
                    <span className="text-[10px] font-mono text-[#5F6368]">
                      Equipo: {activePlan.team_name}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#202124]">{activePlan.targetRole}</h3>
                  <p className="text-xs text-[#3C4043] mt-2 leading-relaxed">
                    {activePlan.executiveSummary}
                  </p>

                  {activePlan.detectedGapsAddressed.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      <span className="text-[10px] text-[#5F6368] font-medium">
                        Brechas cubiertas:
                      </span>
                      {activePlan.detectedGapsAddressed.map((g) => (
                        <span
                          key={g}
                          className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC] font-medium"
                        >
                          {translateLabel(g)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={copyPlanMarkdown}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] border border-[#DADCE0] text-[#202124] text-xs font-medium shrink-0 cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-[#1E8E3E]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#5F6368]" />
                  )}
                  <span>{copied ? 'Plan Copiado' : 'Copiar Plan para Líder'}</span>
                </button>
              </div>

              {/* Weeks Timeline */}
              <div className="space-y-5">
                {activePlan.weeks.map((week, wIdx) => (
                  <div
                    key={week.weekNumber}
                    className="p-4 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-xl border font-bold text-xs flex items-center justify-center ${
                            WEEK_BADGE_COLORS[wIdx % WEEK_BADGE_COLORS.length]
                          }`}
                        >
                          S{week.weekNumber}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-[#202124]">
                            Semana {week.weekNumber}: {week.theme}
                          </h4>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-[#5F6368] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {week.totalMinutes} min est.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {week.modules.map((mod, mIdx) => (
                        <div
                          key={mIdx}
                          className="p-3.5 rounded-xl bg-white border border-[#E8EAED] shadow-2xs flex flex-col justify-between space-y-2 hover:border-[#AECBFA] transition-colors"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2]">
                                {translateLabel(mod.content_type)}
                              </span>
                              <span className="text-[10px] font-mono text-[#5F6368]">
                                {translateLabel(mod.level)} • {mod.estimatedMinutes} min
                              </span>
                            </div>
                            <h5 className="text-xs font-semibold text-[#202124] line-clamp-2">
                              {mod.name}
                            </h5>
                            <p className="text-[11px] text-[#5F6368] mt-1 leading-snug">
                              {mod.objective}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-[#E8EAED] flex items-center justify-between text-[10px]">
                            <span className="text-[#5F6368]">{translateLabel(mod.category)}</span>
                            <a
                              href={mod.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#1A73E8] hover:text-[#1557B0] font-semibold"
                            >
                              Abrir módulo
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="google-card p-16 text-center text-[#5F6368] text-xs flex flex-col items-center gap-3">
              <Sparkles className="w-8 h-8 text-[#9334E6]" />
              <span>
                Configura el rol objetivo arriba y presiona{' '}
                <strong>"Generar Ruta de Aprendizaje"</strong> para crear tu primer plan semanal con IA.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
