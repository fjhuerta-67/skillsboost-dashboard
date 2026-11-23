import React, { useState, useEffect } from 'react';
import { TeamStats, MemberDrilldown, MemberAISummary } from '../types';
import { translateLabel } from '../lib/i18n';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  Users,
  Target,
  Clock,
  TrendingUp,
  Award,
  BookOpen,
  ChevronRight,
  X,
  ExternalLink,
  CheckCircle2,
  Briefcase,
  Layers,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Compass,
  GraduationCap,
} from 'lucide-react';

interface TeamDashboardProps {
  teams: TeamStats[];
  selectedMemberEmail: string | null;
  onClearSelectedMember: () => void;
  onSelectMember: (email: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'AI & Machine Learning': '#9334E6',
  'Data & Analytics': '#4285F4',
  'Cloud Security & IAM': '#EA4335',
  'Containers & Kubernetes': '#34A853',
  'DevOps & SRE': '#FBBC04',
  'Cloud Infrastructure': '#12B5CB',
};

export const TeamDashboard: React.FC<TeamDashboardProps> = ({
  teams,
  selectedMemberEmail,
  onClearSelectedMember,
  onSelectMember,
}) => {
  const [selectedTeamSlug, setSelectedTeamSlug] = useState<string>(teams[0]?.team_slug || '');
  const [memberDrilldown, setMemberDrilldown] = useState<MemberDrilldown | null>(null);
  const [loadingMember, setLoadingMember] = useState(false);
  const [aiSummary, setAiSummary] = useState<MemberAISummary | null>(null);
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);

  useEffect(() => {
    if (!selectedTeamSlug && teams.length > 0) {
      setSelectedTeamSlug(teams[0].team_slug);
    }
  }, [teams, selectedTeamSlug]);

  const fetchMemberAiSummary = async (email: string, forceRefresh = false) => {
    setLoadingAiSummary(true);
    try {
      const url = `/api/analytics/members/${encodeURIComponent(email)}/ai-summary${
        forceRefresh ? '?refresh=true' : ''
      }`;
      const res = await fetch(url).then((r) => r.json());
      if (res.ok && res.summary) {
        setAiSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load Gemini member summary:', err);
    } finally {
      setLoadingAiSummary(false);
    }
  };

  useEffect(() => {
    if (selectedMemberEmail) {
      setLoadingMember(true);
      setAiSummary(null);
      fetch(`/api/analytics/members/${encodeURIComponent(selectedMemberEmail)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.member) {
            setMemberDrilldown(data.member);
            if (data.member.team_slug) {
              setSelectedTeamSlug(data.member.team_slug);
            }
          }
        })
        .catch((err) => console.error('Failed to load member drilldown:', err))
        .finally(() => setLoadingMember(false));

      fetchMemberAiSummary(selectedMemberEmail, false);
    } else {
      setMemberDrilldown(null);
      setAiSummary(null);
    }
  }, [selectedMemberEmail]);

  const activeTeam = teams.find((t) => t.team_slug === selectedTeamSlug) || teams[0];

  if (!activeTeam) {
    return (
      <div className="google-card p-12 text-center text-[#5F6368]">
        No hay información de equipos disponible. Por favor sincroniza los datos.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Team Selector & Header */}
      <div className="google-card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-l-4 border-l-[#4285F4]">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-[#1967D2] bg-[#E8F0FE] px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Equipo y Unidad Organizacional</span>
          </div>
          <h2 className="text-xl font-bold text-[#202124]">{activeTeam.name}</h2>
          <p className="text-xs text-[#5F6368] mt-1 max-w-2xl">{activeTeam.description}</p>
        </div>

        {/* Team Selector Pill Buttons */}
        <div className="flex flex-wrap gap-2">
          {teams.map((t) => {
            const isSelected = t.team_slug === activeTeam.team_slug;
            return (
              <button
                key={t.team_slug}
                onClick={() => setSelectedTeamSlug(t.team_slug)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[#1A73E8] text-white border-[#1A73E8] shadow-sm'
                    : 'bg-[#F8FAFD] text-[#3C4043] border-[#DADCE0] hover:bg-[#E8F0FE] hover:text-[#174EA6] hover:border-[#AECBFA]'
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Team KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#4285F4]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Capacitaciones del Equipo
            </span>
            <div className="p-2 rounded-xl bg-[#E8F0FE] text-[#1A73E8]">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124] tracking-tight">
            {activeTeam.trainingsTaken}
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            <span className="text-[#137333] font-semibold">
              {activeTeam.trainingsCompleted} completadas
            </span>
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#34A853]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Tasa de Finalización
            </span>
            <div className="p-2 rounded-xl bg-[#E6F4EA] text-[#1E8E3E]">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124] tracking-tight">
            {activeTeam.completionRate}%
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            <span>Velocidad general de finalización</span>
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#EA4335]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Horas Totales del Equipo
            </span>
            <div className="p-2 rounded-xl bg-[#FCE8E6] text-[#D93025]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124] tracking-tight">
            {activeTeam.totalHours}{' '}
            <span className="text-lg font-normal text-[#5F6368]">hrs</span>
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            <span>Tiempo dedicado por el equipo</span>
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#FBBC04]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Tiempo Prom. / Miembro
            </span>
            <div className="p-2 rounded-xl bg-[#FEF7E0] text-[#E37400]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124] tracking-tight">
            {activeTeam.avgHoursPerMember}{' '}
            <span className="text-lg font-normal text-[#5F6368]">hrs</span>
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            <span>Por integrante del equipo</span>
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#9334E6]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Plantilla del Equipo
            </span>
            <div className="p-2 rounded-xl bg-[#F3E8FD] text-[#9334E6]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124] tracking-tight">
            {activeTeam.member_count}
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            <span>Miembros inscritos</span>
          </div>
        </div>
      </div>

      {/* Overall Team Focus & Most Usual Trainings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Focus Breakdown */}
        <div className="google-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#9334E6]" />
                Enfoque General del Equipo y Dominio de Conocimiento
              </h3>
              <p className="text-xs text-[#5F6368] mt-0.5">
                Distribución de categorías de capacitación según el mapeo del catálogo de cursos
              </p>
            </div>
          </div>

          <div className="space-y-3.5 mt-4">
            {activeTeam.focusDistribution.map((focus) => {
              const color = CATEGORY_COLORS[focus.category] || '#4285F4';
              return (
                <div key={focus.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#3C4043]">
                      {translateLabel(focus.category)}
                    </span>
                    <span className="text-[#5F6368] font-mono font-medium">
                      {focus.hours} hrs ({focus.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#F1F3F4] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(focus.percentage, 4)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most Usual Trainings for this Team */}
        <div className="google-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#1E8E3E]" />
                Capacitaciones Más Frecuentes en este Equipo
              </h3>
              <p className="text-xs text-[#5F6368] mt-0.5">
                Principales módulos completados por {activeTeam.name}
              </p>
            </div>
          </div>

          <div className="space-y-2.5 mt-4">
            {activeTeam.mostPopularTrainings.length === 0 ? (
              <p className="text-xs text-[#5F6368] py-6 text-center">
                Aún no hay capacitaciones registradas para este equipo.
              </p>
            ) : (
              activeTeam.mostPopularTrainings.map((training, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#F8FAFD] border border-[#E8EAED] flex items-center justify-between hover:bg-white transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono font-semibold text-[#5F6368]">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-semibold text-[#202124] line-clamp-1">
                        {training.name}
                      </h4>
                      <span className="text-[10px] text-[#1A73E8] uppercase font-bold">
                        {translateLabel(training.type)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-xs font-bold text-[#202124]">{training.takenCount}</span>
                    <span className="text-[10px] text-[#5F6368] block">veces tomada</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top 10 People Having Been Trained in this Team */}
      <div className="google-card overflow-hidden">
        <div className="p-6 border-b border-[#E8EAED]">
          <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#FBBC04]" />
            Top 10 Integrantes Capacitados del Equipo
          </h3>
          <p className="text-xs text-[#5F6368] mt-0.5">
            Haz clic en cualquier integrante para ver su historial personal de aprendizaje y áreas de enfoque
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8EAED] bg-[#F8FAFD] text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider">
                <th className="py-3.5 px-6">Posición</th>
                <th className="py-3.5 px-6">Nombre del Integrante</th>
                <th className="py-3.5 px-6">Correo Electrónico</th>
                <th className="py-3.5 px-6 text-center">Capacitaciones Completadas</th>
                <th className="py-3.5 px-6 text-center">Horas Invertidas</th>
                <th className="py-3.5 px-6 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED] text-xs">
              {activeTeam.top10Members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#5F6368]">
                    No se encontraron integrantes en este equipo.
                  </td>
                </tr>
              ) : (
                activeTeam.top10Members.map((member, idx) => (
                  <tr
                    key={member.email}
                    onClick={() => onSelectMember(member.email)}
                    className="hover:bg-[#F8FAFD] cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-6 font-mono font-semibold text-[#5F6368]">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-[#202124] group-hover:text-[#1A73E8] transition-colors">
                      {member.name}
                    </td>
                    <td className="py-3.5 px-6 text-[#5F6368] font-mono text-[11px]">
                      {member.email}
                    </td>
                    <td className="py-3.5 px-6 text-center font-bold text-[#202124]">
                      {member.completedCount}
                    </td>
                    <td className="py-3.5 px-6 text-center font-bold text-[#1A73E8]">
                      {member.hoursSpent} hrs
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button className="text-xs px-3 py-1 rounded-full bg-[#E8F0FE] text-[#1967D2] hover:bg-[#1A73E8] hover:text-white font-medium transition-all flex items-center gap-1 ml-auto cursor-pointer">
                        <span>Ver Detalle</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INDIVIDUAL LEARNER DRILLDOWN MODAL / DRAWER */}
      {selectedMemberEmail && (
        <div className="fixed inset-0 z-50 bg-[#202124]/45 backdrop-blur-xs flex justify-end animate-fadeIn">
          <div className="w-full max-w-3xl bg-white border-l border-[#DADCE0] h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="google-rainbow-bar h-1.5 -mx-6 -mt-6 mb-4" />

            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-[#E8EAED] pb-4">
              <div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC]">
                  Perfil Detallado del Estudiante
                </span>
                <h3 className="text-xl font-bold text-[#202124] mt-1.5">
                  {memberDrilldown?.name || selectedMemberEmail}
                </h3>
                <p className="text-xs text-[#5F6368] font-mono">{selectedMemberEmail}</p>
                <p className="text-xs text-[#1A73E8] mt-1 font-semibold">
                  {translateLabel(memberDrilldown?.team_name)}
                </p>
              </div>
              <button
                onClick={onClearSelectedMember}
                className="p-2 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#5F6368] hover:text-[#202124] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingMember ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-3">
                <div className="w-8 h-8 border-3 border-[#E8F0FE] border-t-[#1A73E8] rounded-full animate-spin" />
                <p className="text-xs text-[#5F6368]">
                  Obteniendo actividades del estudiante desde la base de datos...
                </p>
              </div>
            ) : memberDrilldown ? (
              <>
                {/* Member KPI Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED] text-center">
                    <span className="text-[10px] text-[#5F6368] font-semibold block uppercase">
                      Actividades Totales
                    </span>
                    <span className="text-lg font-bold text-[#202124]">
                      {memberDrilldown.totalActivities}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#E6F4EA]/60 border border-[#CEEAD6] text-center">
                    <span className="text-[10px] text-[#137333] font-semibold block uppercase">
                      Completadas
                    </span>
                    <span className="text-lg font-bold text-[#137333]">
                      {memberDrilldown.completedActivities}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#E8F0FE]/60 border border-[#D2E3FC] text-center">
                    <span className="text-[10px] text-[#1967D2] font-semibold block uppercase">
                      Horas Totales
                    </span>
                    <span className="text-lg font-bold text-[#1A73E8]">
                      {memberDrilldown.totalHours} hrs
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F3E8FD]/60 border border-[#D7AEFB] text-center">
                    <span className="text-[10px] text-[#7627BB] font-semibold block uppercase">
                      Tasa de Aprobación
                    </span>
                    <span className="text-lg font-bold text-[#7627BB]">
                      {memberDrilldown.passRate}%
                    </span>
                  </div>
                </div>

                {/* GOOGLE GEMINI — INDIVIDUAL TALENT & CERTIFICATION ASSESSMENT */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#E8F0FE]/70 via-white to-[#F3E8FD]/60 border border-[#D2E3FC] space-y-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D2E3FC]">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-xl bg-white text-[#9334E6] border border-[#D7AEFB] shadow-2xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#202124]">
                          Resumen Inteligente y Dictamen de Certificación
                        </h4>
                        <span className="text-[10px] text-[#5F6368] font-mono">
                          Evaluado por {aiSummary?.generatedByModel || 'Google Gemini'} • Asesor de Talento Cloud
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchMemberAiSummary(selectedMemberEmail, true)}
                      disabled={loadingAiSummary}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-[#F8FAFD] border border-[#DADCE0] text-[11px] font-medium text-[#3C4043] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingAiSummary ? 'animate-spin' : ''}`} />
                      <span>{loadingAiSummary ? 'Analizando...' : 'Regenerar'}</span>
                    </button>
                  </div>

                  {loadingAiSummary && !aiSummary ? (
                    <div className="py-6 flex items-center space-x-3 text-xs text-[#174EA6]">
                      <div className="w-4 h-4 border-2 border-[#D2E3FC] border-t-[#1A73E8] rounded-full animate-spin shrink-0" />
                      <span>
                        <strong>Google Gemini</strong> está evaluando el historial de cursos, área de conocimiento y elegibilidad para certificación...
                      </span>
                    </div>
                  ) : aiSummary ? (
                    <div className="space-y-4 text-xs">
                      {/* Role & Knowledge Area Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F0FE] text-[#174EA6] border border-[#AECBFA] font-semibold text-xs">
                          <Briefcase className="w-3.5 h-3.5 text-[#1A73E8]" />
                          Rol: {aiSummary.assignedProfileRole}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] font-medium text-[11px]">
                          Área Principal: <strong>{aiSummary.primaryKnowledgeArea}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F3E8FD] text-[#7627BB] border border-[#D7AEFB] font-semibold text-[11px]">
                          Nivel: {aiSummary.maturityLevel}
                        </span>
                      </div>

                      {/* 1. What the user has studied */}
                      <div className="p-4 rounded-xl bg-white border border-[#E8EAED] space-y-1.5 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A73E8] block">
                          1. ¿Qué ha estudiado el colaborador?
                        </span>
                        <MarkdownRenderer content={aiSummary.studySummaryMarkdown} />
                        {aiSummary.secondarySkills.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-2">
                            <span className="text-[10px] text-[#5F6368]">
                              Competencias detectadas:
                            </span>
                            {aiSummary.secondarySkills.map((sk, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-full bg-[#F1F3F4] border border-[#DADCE0] text-[10px] text-[#3C4043] font-medium"
                              >
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 2. Certification Readiness Assessment */}
                      <div
                        className={`p-4 rounded-xl border space-y-2 ${
                          aiSummary.certificationAssessment.isEligible
                            ? 'bg-[#E6F4EA]/60 border-[#A8DAB5]'
                            : aiSummary.certificationAssessment.statusLabel ===
                              'En Preparación Avanzada'
                            ? 'bg-[#FEF7E0]/70 border-[#FDD663]'
                            : 'bg-white border-[#E8EAED]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <GraduationCap
                              className={`w-4 h-4 ${
                                aiSummary.certificationAssessment.isEligible
                                  ? 'text-[#1E8E3E]'
                                  : 'text-[#E37400]'
                              }`}
                            />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#3C4043]">
                              2. Aptitud para Certificación Oficial Google Cloud
                            </span>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              aiSummary.certificationAssessment.isEligible
                                ? 'bg-[#E6F4EA] text-[#137333] border-[#A8DAB5]'
                                : aiSummary.certificationAssessment.statusLabel ===
                                  'En Preparación Avanzada'
                                ? 'bg-[#FEF7E0] text-[#B06000] border-[#FDD663]'
                                : 'bg-[#E8F0FE] text-[#1967D2] border-[#D2E3FC]'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {aiSummary.certificationAssessment.isEligible
                              ? 'SÍ ES APTO — Listo para Examen'
                              : aiSummary.certificationAssessment.statusLabel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-0.5">
                          <span className="font-bold text-[#202124]">
                            {aiSummary.certificationAssessment.recommendedCertification}
                          </span>
                          <span className="font-mono font-bold text-[#1A73E8]">
                            {aiSummary.certificationAssessment.readinessScore}% preparación
                          </span>
                        </div>

                        <div className="w-full bg-[#F1F3F4] rounded-full h-2.5 overflow-hidden border border-[#DADCE0]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              aiSummary.certificationAssessment.isEligible
                                ? 'bg-gradient-to-r from-[#34A853] to-[#12B5CB]'
                                : 'bg-gradient-to-r from-[#FBBC04] to-[#4285F4]'
                            }`}
                            style={{
                              width: `${aiSummary.certificationAssessment.readinessScore}%`,
                            }}
                          />
                        </div>

                        <MarkdownRenderer
                          content={aiSummary.certificationAssessment.rationaleMarkdown}
                        />
                      </div>

                      {/* 3. Recommendations to keep progressing */}
                      <div className="p-4 rounded-xl bg-white border border-[#E8EAED] space-y-2.5 shadow-2xs">
                        <div className="flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-[#E37400]" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#B06000]">
                            3. Recomendaciones para Seguir Progresando
                          </span>
                        </div>

                        <ul className="space-y-1.5">
                          {aiSummary.progressionStepsMarkdown.map((step, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-2 text-[#3C4043]">
                              <span className="w-4 h-4 rounded-full bg-[#E8F0FE] border border-[#D2E3FC] text-[#1967D2] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {sIdx + 1}
                              </span>
                              <div className="flex-1">
                                <MarkdownRenderer content={step} />
                              </div>
                            </li>
                          ))}
                        </ul>

                        {aiSummary.recommendedCatalogItems.length > 0 && (
                          <div className="pt-2.5 border-t border-[#E8EAED] space-y-2">
                            <span className="text-[10px] font-semibold text-[#5F6368] block">
                              Siguientes cursos/laboratorios recomendados en el catálogo:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {aiSummary.recommendedCatalogItems.map((rec, rIdx) => (
                                <div
                                  key={rIdx}
                                  className="p-2.5 rounded-xl bg-[#F8FAFD] border border-[#E8EAED] flex flex-col justify-between"
                                >
                                  <div>
                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2]">
                                      {translateLabel(rec.type)} • {rec.level}
                                    </span>
                                    <div className="font-semibold text-[#202124] text-[11px] mt-1 line-clamp-2">
                                      {rec.name}
                                    </div>
                                    <p className="text-[10px] text-[#5F6368] mt-0.5 line-clamp-2">
                                      {rec.reason}
                                    </p>
                                  </div>
                                  <a
                                    href={rec.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-[#1A73E8] hover:text-[#1557B0] font-semibold mt-2"
                                  >
                                    Ir al curso
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Individual Learning Focus */}
                <div className="p-4 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#5F6368] mb-3">
                    Distribución Cuantitativa por Dominio Técnico
                  </h4>
                  <div className="space-y-2.5">
                    {memberDrilldown.categories.map((c) => (
                      <div key={c.category} className="flex items-center justify-between text-xs">
                        <span className="text-[#202124] font-medium">
                          {translateLabel(c.category)}
                        </span>
                        <span className="font-mono text-[#5F6368]">
                          {c.hours} hrs ({c.count} módulos)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detailed Activities List */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#5F6368] mb-3">
                    Historial de Actividades y Cursos (API de Google Skills)
                  </h4>
                  <div className="space-y-3">
                    {memberDrilldown.activities.map((act, i) => (
                      <div
                        key={act.id || i}
                        className="p-4 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED] hover:border-[#AECBFA] hover:bg-white transition-all flex flex-col space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC]">
                                {translateLabel(act['Activity Type'])}
                              </span>
                              <span className="text-[10px] font-mono text-[#5F6368]">
                                {act['Content ID']}
                              </span>
                            </div>
                            <h5 className="text-sm font-semibold text-[#202124] mt-1">
                              {act.Activity}
                            </h5>
                          </div>

                          <div>
                            {act.Passed === 'true' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
                                <CheckCircle2 className="w-3 h-3" />
                                Aprobado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F1F3F4] text-[#5F6368] border border-[#DADCE0]">
                                En Curso
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-[11px] text-[#5F6368] pt-2 border-t border-[#E8EAED] gap-2">
                          <div>
                            Calificación:{' '}
                            <span className="font-bold text-[#202124]">{act['Given Score']}</span> /{' '}
                            {act['Maximum Score']}
                            <span className="mx-2">•</span>
                            Tiempo:{' '}
                            <span className="font-bold text-[#1A73E8]">
                              {act['Learning time (minutes)']} min
                            </span>
                          </div>

                          <div className="flex items-center space-x-3">
                            <span>
                              Inicio:{' '}
                              {act['Date started'] ? act['Date started'].split(' ')[0] : 'N/A'}
                            </span>
                            {act['Content Url'] && (
                              <a
                                href={act['Content Url']}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#1A73E8] hover:text-[#1557B0] font-semibold"
                              >
                                Ver en Catálogo
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
