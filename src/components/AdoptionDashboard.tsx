import React, { useState } from 'react';
import { AdoptionStats } from '../types';
import { translateLabel } from '../lib/i18n';
import {
  UserCheck,
  UserX,
  AlertTriangle,
  Repeat,
  TrendingDown,
  Search,
  Download,
  ChevronRight,
  Users,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface AdoptionDashboardProps {
  stats: AdoptionStats | null;
  isLoading: boolean;
  onSelectMember: (email: string) => void;
}

const FUNNEL_COLORS = ['#4285F4', '#12B5CB', '#34A853', '#9334E6', '#FBBC04'];

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#DADCE0',
  borderRadius: '12px',
  fontSize: '12px',
  color: '#202124',
  boxShadow: '0 4px 14px rgba(60, 64, 67, 0.12)',
};

export const AdoptionDashboard: React.FC<AdoptionDashboardProps> = ({
  stats,
  isLoading,
  onSelectMember,
}) => {
  const [riskFilter, setRiskFilter] = useState<
    'Todos' | 'Sin Uso' | 'En Riesgo' | 'Activo' | 'Cohorte Previa'
  >('Todos');
  const [funnelMode, setFunnelMode] = useState<'current' | 'historical'>('current');
  const [searchTerm, setSearchTerm] = useState('');

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#E6F4EA] border-t-[#34A853] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Analizando adopción de licencias, retención y abandono...
        </p>
      </div>
    );
  }

  const yr = stats.currentYearLabel || '2026';
  const hist = stats.historicalSummary;
  const activeFunnel = funnelMode === 'historical' && hist ? hist.funnel : stats.funnel;

  const statusCounts = {
    Todos: stats.memberStatuses.length,
    'Sin Uso': stats.memberStatuses.filter((m) => m.riskStatus === 'Sin Uso').length,
    'En Riesgo': stats.memberStatuses.filter((m) => m.riskStatus === 'En Riesgo').length,
    Activo: stats.memberStatuses.filter((m) => m.riskStatus === 'Activo').length,
    'Cohorte Previa': stats.memberStatuses.filter((m) => m.riskStatus === 'Cohorte Previa').length,
  };

  const filteredMembers = stats.memberStatuses.filter((m) => {
    const matchesFilter = riskFilter === 'Todos' || m.riskStatus === riskFilter;
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.team_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const visibleMembers = filteredMembers.slice(0, 250);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Banner Header */}
      <div className="google-card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-l-4 border-l-[#34A853]">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#137333] bg-[#E6F4EA] px-2.5 py-0.5 rounded-full">
            Retorno de Inversión (ROI) y Aprovechamiento — Contrato Vigente {yr}
          </span>
          <h2 className="text-xl font-bold text-[#202124] mt-2">
            Adopción de Licencias, Retención y Conciliación Histórica
          </h2>
          <p className="text-xs text-[#5F6368] mt-1">
            Control ejecutivo sobre el cupo concurrente de {stats.totalSeats.toLocaleString()}{' '}
            licencias vigentes en {yr}, separado del histórico multianual de invitaciones y rotación.
          </p>
        </div>

        <a
          href="/api/export/csv?type=adoption"
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-full bg-[#1E8E3E] hover:bg-[#137333] text-white text-xs font-semibold transition-all shadow-sm shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Sábana de Licencias (CSV)</span>
        </a>
      </div>

      {/* Top 5 KPIs — Current Contract Pool */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#4285F4]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Cupo Vigente Contratado
            </span>
            <div className="p-2 rounded-xl bg-[#E8F0FE] text-[#1A73E8]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124]">
            {stats.totalSeats.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Asientos concurrentes •{' '}
            <span className="text-[#1967D2] font-semibold">
              {stats.activeLast12Months.toLocaleString()}
            </span>{' '}
            activos últ. 12m
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#34A853]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Tasa de Uso ({yr})
            </span>
            <div className="p-2 rounded-xl bg-[#E6F4EA] text-[#1E8E3E]">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#137333]">{stats.activationRate}%</div>
          <div className="mt-2 text-xs text-[#5F6368]">
            <span className="text-[#202124] font-semibold">
              {stats.learnersWithActivity.toLocaleString()}
            </span>{' '}
            en {yr} •{' '}
            <span className="text-[#137333] font-semibold">
              {stats.activeLast30Days.toLocaleString()}
            </span>{' '}
            últ. 30d
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#EA4335]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Licencias Sin Uso ({yr})
            </span>
            <div className="p-2 rounded-xl bg-[#FCE8E6] text-[#D93025]">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#C5221F]">
            {stats.zeroActivityCount.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            De {stats.totalSeats.toLocaleString()} asientos sin actividad en {yr}
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#FBBC04]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              En Riesgo ({yr})
            </span>
            <div className="p-2 rounded-xl bg-[#FEF7E0] text-[#E37400]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#E37400]">
            {stats.atRiskCount.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Con uso en {yr}, pero +30d inactivos
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#9334E6]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Recurrentes ({yr})
            </span>
            <div className="p-2 rounded-xl bg-[#F3E8FD] text-[#9334E6]">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#7627BB]">
            {stats.recurringLearners.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Hábito continuo (≥ 3 módulos en {yr})
          </div>
        </div>
      </div>

      {/* Multi-Year Historical Reconciliation Banner */}
      {hist && hist.totalInvitationsSent > stats.totalSeats && (
        <div className="google-card p-5 bg-[#E8F0FE]/60 border border-[#D2E3FC] flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="space-y-1 max-w-3xl">
            <div className="text-xs font-bold text-[#174EA6] uppercase tracking-wider">
              Conciliación Multianual ({hist.periodLabel}) — ¿Por qué hay más invitaciones históricas que licencias vigentes?
            </div>
            <p className="text-xs text-[#3C4043] leading-relaxed">
              Google Skills contabiliza en{' '}
              <code className="text-[#1967D2] bg-white px-1.5 py-0.5 rounded border border-[#D2E3FC]">
                /organizations/stats
              </code>{' '}
              el acumulado histórico desde el inicio de la organización: se han emitido{' '}
              <strong className="text-[#202124]">{hist.totalInvitationsSent.toLocaleString()}</strong>{' '}
              invitaciones totales (
              <strong className="text-[#137333]">
                {hist.acceptedInvitationsAllTime.toLocaleString()}
              </strong>{' '}
              aceptadas históricas +{' '}
              <strong className="text-[#B06000]">{hist.pendingInvitations.toLocaleString()}</strong>{' '}
              pendientes). Como las licencias son <em>asientos concurrentes reutilizables</em>, la diferencia de{' '}
              <strong className="text-[#1967D2]">
                {hist.estimatedRotatedSeats.toLocaleString()}+ cuentas
              </strong>{' '}
              corresponde a licencias recicladas o reasignadas por rotación de personal entre{' '}
              {hist.periodLabel}.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
            <div className="p-3 rounded-xl bg-white border border-[#D2E3FC] shadow-2xs">
              <span className="text-[10px] uppercase text-[#5F6368] font-semibold block">
                Inv. Emitidas
              </span>
              <span className="font-bold text-[#202124] text-sm">
                {hist.totalInvitationsSent.toLocaleString()}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#D2E3FC] shadow-2xs">
              <span className="text-[10px] uppercase text-[#5F6368] font-semibold block">
                Aceptadas Hist.
              </span>
              <span className="font-bold text-[#137333] text-sm">
                {hist.acceptedInvitationsAllTime.toLocaleString()}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#D2E3FC] shadow-2xs">
              <span className="text-[10px] uppercase text-[#5F6368] font-semibold block">
                Formados Hist.
              </span>
              <span className="font-bold text-[#1A73E8] text-sm">
                {hist.historicalLearnersWithActivity.toLocaleString()}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#D2E3FC] shadow-2xs">
              <span className="text-[10px] uppercase text-[#5F6368] font-semibold block">
                Cohortes Previas
              </span>
              <span className="font-bold text-[#5F6368] text-sm">
                {hist.priorCohortsInactiveThisYear.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Funnel & Team Adoption Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activation Funnel */}
        <div className="google-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#1A73E8]" />
                Embudo de Activación y Retención
              </h3>
              <p className="text-xs text-[#5F6368] mt-0.5">
                {funnelMode === 'current'
                  ? `Conversión estricta sobre el cupo vigente de ${stats.totalSeats.toLocaleString()} licencias (${yr})`
                  : `Conversión histórica acumulada sobre ${hist.totalInvitationsSent.toLocaleString()} invitaciones (${hist.periodLabel})`}
              </p>
            </div>

            {hist && hist.totalInvitationsSent > stats.totalSeats && (
              <div className="flex items-center gap-1 bg-[#F1F3F4] p-1 rounded-full border border-[#DADCE0] shrink-0">
                <button
                  onClick={() => setFunnelMode('current')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    funnelMode === 'current'
                      ? 'bg-[#1A73E8] text-white shadow-2xs'
                      : 'text-[#5F6368] hover:text-[#202124]'
                  }`}
                >
                  Vigencia {yr} ({stats.totalSeats.toLocaleString()})
                </button>
                <button
                  onClick={() => setFunnelMode('historical')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    funnelMode === 'historical'
                      ? 'bg-[#9334E6] text-white shadow-2xs'
                      : 'text-[#5F6368] hover:text-[#202124]'
                  }`}
                >
                  Histórico {hist.periodLabel}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {activeFunnel.map((step, idx) => (
              <div key={step.stage} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#3C4043]">
                    {idx + 1}. {step.stage}
                  </span>
                  <span className="font-mono text-[#5F6368]">
                    <strong className="text-[#202124]">{step.count.toLocaleString()}</strong>{' '}
                    personas ({step.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-[#F1F3F4] rounded-full h-6 p-1 border border-[#E8EAED]">
                  <div
                    className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2.5 text-[10px] font-bold text-white shadow-2xs"
                    style={{
                      width: `${Math.max(step.percentage, 6)}%`,
                      backgroundColor: FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
                    }}
                  >
                    {step.percentage >= 12 ? `${step.percentage}%` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Drop-off summary */}
          {stats.dropOffCourses.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[#E8EAED]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#B06000] flex items-center gap-1.5 mb-3">
                <TrendingDown className="w-3.5 h-3.5 text-[#E37400]" />
                Módulos con Mayor Abandono o No Aprobación
              </h4>
              <div className="space-y-2">
                {stats.dropOffCourses.slice(0, 4).map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs p-3 rounded-xl bg-[#F8FAFD] border border-[#E8EAED]"
                  >
                    <div className="pr-3">
                      <div className="font-semibold text-[#202124] line-clamp-1">{c.name}</div>
                      <span className="text-[10px] text-[#5F6368]">
                        {translateLabel(c.type)} • {c.startedCount} iniciados / {c.completedCount}{' '}
                        aprobados
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF] font-mono font-semibold shrink-0">
                      {c.dropOffRate}% fricción
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Adoption by Team Stacked Bar */}
        <div className="google-card p-6">
          <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1E8E3E]" />
            Licencias con Uso vs. Sin Uso por Equipo ({yr})
          </h3>
          <p className="text-xs text-[#5F6368] mt-0.5 mb-4">
            Distribución exacta de los {stats.totalSeats.toLocaleString()} asientos vigentes (
            {stats.learnersWithActivity.toLocaleString()} activos en {yr} +{' '}
            {stats.zeroActivityCount.toLocaleString()} sin uso)
          </p>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.teamAdoption.slice(0, 10)}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EAED" />
                <XAxis type="number" stroke="#5F6368" fontSize={11} />
                <YAxis
                  dataKey="team_name"
                  type="category"
                  width={150}
                  stroke="#3C4043"
                  fontSize={10}
                  tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend
                  formatter={(val) => (
                    <span className="text-xs text-[#3C4043] font-medium">{val}</span>
                  )}
                />
                <Bar
                  dataKey="activeLearners"
                  name={`Con Uso en ${yr}`}
                  stackId="a"
                  fill="#34A853"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="inactiveLearners"
                  name={`Sin Uso en ${yr}`}
                  stackId="a"
                  fill="#EA4335"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* License Roster & Risk Table */}
      <div className="google-card overflow-hidden">
        <div className="p-6 border-b border-[#E8EAED] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#202124]">
              Auditoría Individual de Colaboradores Identificados (
              {filteredMembers.length.toLocaleString()})
            </h3>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Filtra colaboradores activos en {yr}, en riesgo (+30d), sin uso en sub-equipos o de cohortes históricas previas
            </p>
            {(stats.unidentifiedInactiveSeats || 0) > 0 && (
              <p className="text-[11px] text-[#B06000] mt-2 bg-[#FEF7E0] border border-[#FEEFC3] rounded-xl px-3 py-1.5 inline-block">
                Nota API v2: Se listan los{' '}
                <strong>{stats.memberStatuses.length.toLocaleString()}</strong> correos identificables (colaboradores con actividad histórica e integrantes de sub-equipos). De los{' '}
                <strong>{stats.zeroActivityCount.toLocaleString()}</strong> asientos vigentes sin uso en {yr}, los asientos asignados a nivel raíz sin actividad nunca aparecen con correo individual en la API v2 (solo en el agregado de{' '}
                <code className="font-mono font-semibold">/stats</code>).
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1 bg-[#F1F3F4] p-1 rounded-full border border-[#DADCE0]">
              {(statusCounts['Cohorte Previa'] > 0
                ? (['Todos', 'Sin Uso', 'En Riesgo', 'Activo', 'Cohorte Previa'] as const)
                : (['Todos', 'Sin Uso', 'En Riesgo', 'Activo'] as const)
              ).map((status) => (
                <button
                  key={status}
                  onClick={() => setRiskFilter(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    riskFilter === status
                      ? 'bg-[#1A73E8] text-white shadow-2xs'
                      : 'text-[#5F6368] hover:text-[#202124]'
                  }`}
                >
                  {status} ({statusCounts[status].toLocaleString()})
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6368]" />
              <input
                type="text"
                placeholder="Buscar persona, correo o equipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#F8FAFD] border border-[#DADCE0] rounded-full pl-10 pr-4 py-2 text-xs text-[#202124] placeholder-[#5F6368] focus:bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#F8FAFD]">
              <tr className="border-b border-[#E8EAED] text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider">
                <th className="py-3.5 px-6">Colaborador</th>
                <th className="py-3.5 px-6">Equipo Principal</th>
                <th className="py-3.5 px-6 text-center">Estado Cuenta</th>
                <th className="py-3.5 px-6 text-center">Diagnóstico ROI ({yr})</th>
                <th className="py-3.5 px-6 text-center">Iniciados / Comp.</th>
                <th className="py-3.5 px-6 text-center">Horas</th>
                <th className="py-3.5 px-6 text-center">Última Actividad</th>
                <th className="py-3.5 px-6 text-right">Perfil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED] text-xs">
              {visibleMembers.map((m) => (
                <tr
                  key={m.email}
                  onClick={() => m.activitiesStarted > 0 && onSelectMember(m.email)}
                  className={`transition-colors ${
                    m.activitiesStarted > 0
                      ? 'hover:bg-[#F8FAFD] cursor-pointer'
                      : 'hover:bg-[#F8FAFD]/60'
                  }`}
                >
                  <td className="py-3 px-6">
                    <div className="font-semibold text-[#202124]">{m.name}</div>
                    <div className="text-[11px] font-mono text-[#5F6368]">{m.email}</div>
                  </td>
                  <td className="py-3 px-6 text-[#3C4043]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F1F3F4] border border-[#DADCE0] text-[11px] font-medium">
                      {translateLabel(m.team_name)}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-center">
                    <span className="text-[11px] text-[#3C4043] font-medium">
                      {translateLabel(m.inviteStatus)}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-center">
                    {m.riskStatus === 'Sin Uso' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]">
                        Sin Uso (0 hrs)
                      </span>
                    )}
                    {m.riskStatus === 'En Riesgo' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3]">
                        En Riesgo (+{m.daysSinceLastActivity}d)
                      </span>
                    )}
                    {m.riskStatus === 'Activo' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
                        Activo (≤30d)
                      </span>
                    )}
                    {m.riskStatus === 'Cohorte Previa' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F1F3F4] text-[#5F6368] border border-[#DADCE0]">
                        Cohorte Previa (&lt;{yr})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-center font-mono text-[#3C4043]">
                    {m.activitiesStarted} /{' '}
                    <span className="text-[#137333] font-bold">{m.activitiesCompleted}</span>
                  </td>
                  <td className="py-3 px-6 text-center font-bold text-[#1A73E8]">
                    {m.hoursSpent} hrs
                  </td>
                  <td className="py-3 px-6 text-center text-[#5F6368] font-mono text-[11px]">
                    {m.lastActivityDate ? m.lastActivityDate : 'Nunca'}
                  </td>
                  <td className="py-3 px-6 text-right">
                    {m.activitiesStarted > 0 ? (
                      <button className="text-[#1A73E8] hover:text-[#174EA6] p-1.5 rounded-full hover:bg-[#E8F0FE]">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#9AA0A6]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredMembers.length > 250 && (
          <div className="px-6 py-3 bg-[#F8FAFD] border-t border-[#E8EAED] text-[11px] text-[#5F6368] flex flex-wrap items-center justify-between gap-2">
            <span>
              Mostrando los primeros <strong>250</strong> de{' '}
              <strong>{filteredMembers.length.toLocaleString()}</strong> registros filtrados. Usa el buscador para localizar cualquier correo al instante.
            </span>
            <span>
              El botón Exportar CSV descarga los {stats.memberStatuses.length.toLocaleString()}{' '}
              registros completos.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
