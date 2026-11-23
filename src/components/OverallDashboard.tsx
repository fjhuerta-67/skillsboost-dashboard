import React, { useState } from 'react';
import { OverallStats } from '../types';
import { translateLabel } from '../lib/i18n';
import {
  GraduationCap,
  Clock,
  UserCheck,
  Award,
  TrendingUp,
  Search,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

interface OverallDashboardProps {
  stats: OverallStats | null;
  isLoading: boolean;
  onSelectMember: (email: string) => void;
}

const COLORS = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9334E6', '#12B5CB'];

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#DADCE0',
  borderRadius: '12px',
  fontSize: '12px',
  color: '#202124',
  boxShadow: '0 4px 14px rgba(60, 64, 67, 0.12)',
};

export const OverallDashboard: React.FC<OverallDashboardProps> = ({
  stats,
  isLoading,
  onSelectMember,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#E8F0FE] border-t-[#1A73E8] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Consolidando métricas de capacitación desde Google Skills...
        </p>
      </div>
    );
  }

  const filteredLearners = stats.topLearners.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* KPI Cards Grid — Colorful Google 4-Color Accents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Trainings Taken — Google Blue */}
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#4285F4]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Capacitaciones Tomadas
            </span>
            <div className="p-2 rounded-xl bg-[#E8F0FE] text-[#1A73E8]">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124] tracking-tight">
            {stats.totalTrainingsTaken.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center text-xs text-[#5F6368] space-x-1">
            <span className="text-[#137333] font-semibold">
              {stats.totalCompletions.toLocaleString()} aprobadas
            </span>
            <span>•</span>
            <span>{(stats.totalTrainingsTaken - stats.totalCompletions).toLocaleString()} en curso</span>
          </div>
        </div>

        {/* Total Hours Overall — Google Green */}
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#34A853]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Horas Totales</span>
            <div className="p-2 rounded-xl bg-[#E6F4EA] text-[#1E8E3E]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124] tracking-tight">
            {stats.totalHoursSpent.toLocaleString()}{' '}
            <span className="text-lg font-normal text-[#5F6368]">hrs</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-[#5F6368]">
            <span>Inversión total de la organización</span>
          </div>
        </div>

        {/* Hours Spent Per Person — Google Yellow */}
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#FBBC04]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Horas Prom. / Persona
            </span>
            <div className="p-2 rounded-xl bg-[#FEF7E0] text-[#E37400]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124] tracking-tight">
            {stats.avgHoursPerPerson.toLocaleString()}{' '}
            <span className="text-lg font-normal text-[#5F6368]">hrs</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-[#5F6368]">
            <span>Por colaborador con actividad</span>
          </div>
        </div>

        {/* Pass Rate % — Google Red */}
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#EA4335]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Tasa de Aprobación
            </span>
            <div className="p-2 rounded-xl bg-[#FCE8E6] text-[#D93025]">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124] tracking-tight">{stats.passRate}%</div>
          <div className="mt-2 flex items-center text-xs text-[#5F6368] space-x-1">
            <span className="text-[#C5221F] font-semibold">
              {stats.totalPassed.toLocaleString()} actividades acreditadas
            </span>
          </div>
        </div>

        {/* Active Learners — Gemini Purple / Google Blue */}
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#9334E6]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Colaboradores Formados
            </span>
            <div className="p-2 rounded-xl bg-[#F3E8FD] text-[#9334E6]">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124] tracking-tight">
            {stats.totalActiveLearners.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center text-xs text-[#5F6368] space-x-1">
            {stats.currentYearActiveLearners !== undefined &&
            stats.contractedLicenses !== undefined ? (
              <>
                <span className="text-[#1967D2] font-semibold">
                  {stats.currentYearActiveLearners.toLocaleString()} activos en{' '}
                  {stats.currentYearLabel || '2026'}
                </span>
                <span>•</span>
                <span>de {stats.contractedLicenses.toLocaleString()} licencias</span>
              </>
            ) : (
              <span>Colaboradores con actividad en la org.</span>
            )}
          </div>
        </div>
      </div>

      {/* Official Organization Statistics Strip */}
      {(stats.skillsBadgesEarned !== undefined ||
        stats.officialAcceptedInvitations !== undefined) && (
        <div className="google-card p-4 bg-gradient-to-r from-[#E8F0FE]/70 via-white to-[#E6F4EA]/50 border border-[#D2E3FC] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC]">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#202124]">
                Conciliación Oficial — Contrato Vigente vs. Histórico Multianual (API v2)
              </div>
              <div className="text-[11px] text-[#5F6368]">
                Cupo concurrente actual frente al acumulado histórico de{' '}
                <code className="text-[#1967D2] bg-[#E8F0FE] px-1.5 py-0.5 rounded">
                  /organizations/stats
                </code>{' '}
                (incluye rotación de licencias)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs">
            {stats.contractedLicenses !== undefined && (
              <div>
                <span className="text-[#5F6368] block text-[10px] uppercase font-semibold">
                  Cupo Vigente
                </span>
                <span className="font-bold text-[#202124] text-sm">
                  {stats.contractedLicenses.toLocaleString()} licencias
                </span>
                {stats.currentYearActiveLearners !== undefined && (
                  <span className="text-[#1967D2] ml-1.5 text-[11px] font-medium">
                    ({stats.currentYearActiveLearners.toLocaleString()} en uso{' '}
                    {stats.currentYearLabel || '2026'})
                  </span>
                )}
              </div>
            )}
            {stats.officialAcceptedInvitations !== undefined && (
              <div>
                <span className="text-[#5F6368] block text-[10px] uppercase font-semibold">
                  Inv. Aceptadas (Hist. 2020–{String(stats.currentYearLabel || '2026').slice(-2)})
                </span>
                <span className="font-bold text-[#137333] text-sm">
                  {stats.officialAcceptedInvitations.toLocaleString()}
                </span>
                {stats.estimatedRotatedSeats !== undefined && stats.estimatedRotatedSeats > 0 && (
                  <span className="text-[#5F6368] ml-1 text-[11px]">
                    (incl. {stats.estimatedRotatedSeats.toLocaleString()}+ rotadas)
                  </span>
                )}
                {stats.officialPendingInvitations !== undefined && (
                  <span className="text-[#5F6368] ml-1 text-[11px]">
                    • +{stats.officialPendingInvitations.toLocaleString()} pend.
                  </span>
                )}
              </div>
            )}
            {stats.skillsBadgesEarned !== undefined && (
              <div>
                <span className="text-[#5F6368] block text-[10px] uppercase font-semibold">
                  Skill Badges (Hist.)
                </span>
                <span className="font-bold text-[#E37400] text-sm">
                  {stats.skillsBadgesEarned.toLocaleString()}
                </span>
              </div>
            )}
            {stats.officialCoursesCompleted !== undefined && (
              <div>
                <span className="text-[#5F6368] block text-[10px] uppercase font-semibold">
                  Cursos Completados
                </span>
                <span className="font-bold text-[#1A73E8] text-sm">
                  {stats.officialCoursesCompleted.toLocaleString()}
                </span>
              </div>
            )}
            {stats.officialLabsPassed !== undefined && (
              <div>
                <span className="text-[#5F6368] block text-[10px] uppercase font-semibold">
                  Labs Aprobados
                </span>
                <span className="font-bold text-[#9334E6] text-sm">
                  {stats.officialLabsPassed.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts Section: Velocity Timeline & Activity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline (2 cols) */}
        <div className="google-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#1A73E8]" />
                Velocidad de Finalización en el Tiempo
              </h3>
              <p className="text-xs text-[#5F6368] mt-0.5">
                Capacitaciones completadas mensualmente y horas totales dedicadas en Google Skills
              </p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats.activityTimeline}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorCompletions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4285F4" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#4285F4" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34A853" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#34A853" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EAED" />
                <XAxis dataKey="date" stroke="#5F6368" fontSize={11} />
                <YAxis stroke="#5F6368" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="completions"
                  name="Completadas"
                  stroke="#1A73E8"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCompletions)"
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  name="Horas Invertidas"
                  stroke="#34A853"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorHours)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Type Breakdown (Donut) */}
        <div className="google-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[#34A853]" />
              Formatos de Actividad
            </h3>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Desglose por Laboratorios, Cursos y Certificaciones
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.activityTypeBreakdown.map((entry) => ({
                    ...entry,
                    displayType: translateLabel(entry.type),
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="displayType"
                >
                  {stats.activityTypeBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-[#3C4043] font-medium">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Most Usual / Popular Trainings */}
      <div className="google-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#E37400]" />
              Capacitaciones Más Frecuentes
            </h3>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Clasificadas por total de inscripciones y calificación promedio entre todos los estudiantes
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.mostPopularTrainings.map((training, idx) => {
            const topColors = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'];
            const accent = topColors[idx % topColors.length];
            return (
              <div
                key={training.content_id || idx}
                className="p-4 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED] hover:border-[#AECBFA] hover:bg-white hover:shadow-sm transition-all flex flex-col justify-between relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: accent }}
                />
                <div>
                  <div className="flex items-center justify-between mb-2 pt-1">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC]">
                      {translateLabel(training.type)}
                    </span>
                    <span className="text-xs text-[#5F6368] font-mono font-semibold">
                      #{idx + 1}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-[#202124] line-clamp-2 leading-snug">
                    {training.name}
                  </h4>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8EAED] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#5F6368]">Inscripciones: </span>
                    <span className="font-bold text-[#202124]">{training.takenCount}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[#5F6368]">Prom.: </span>
                    <span className="font-bold text-[#137333]">{training.avgScore}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Students / Learners Leaderboard Table */}
      <div className="google-card overflow-hidden">
        <div className="p-6 border-b border-[#E8EAED] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#FBBC04]" />
              Mejores Estudiantes y Alto Desempeño
            </h3>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Miembros de la organización clasificados por capacitaciones completadas y horas totales invertidas
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6368]" />
            <input
              type="text"
              placeholder="Buscar por estudiante o equipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#F8FAFD] border border-[#DADCE0] rounded-full pl-10 pr-4 py-2 text-xs text-[#202124] placeholder-[#5F6368] focus:bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE] transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8EAED] bg-[#F8FAFD] text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider">
                <th className="py-3.5 px-6">Posición</th>
                <th className="py-3.5 px-6">Estudiante</th>
                <th className="py-3.5 px-6">Equipo</th>
                <th className="py-3.5 px-6 text-center">Capacitaciones Completadas</th>
                <th className="py-3.5 px-6 text-center">Evaluaciones Aprobadas</th>
                <th className="py-3.5 px-6 text-center">Horas Totales</th>
                <th className="py-3.5 px-6 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED] text-xs">
              {filteredLearners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#5F6368]">
                    Ningún estudiante coincide con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredLearners.map((learner, idx) => (
                  <tr
                    key={learner.email}
                    onClick={() => onSelectMember(learner.email)}
                    className="hover:bg-[#F8FAFD] cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-6 font-mono text-[#5F6368] font-semibold">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="font-semibold text-[#202124] group-hover:text-[#1A73E8] transition-colors">
                        {learner.name}
                      </div>
                      <div className="text-[11px] text-[#5F6368] font-mono">{learner.email}</div>
                    </td>
                    <td className="py-3.5 px-6 text-[#3C4043]">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#F1F3F4] border border-[#DADCE0] text-[11px] font-medium">
                        {translateLabel(learner.team)}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-center font-bold text-[#202124]">
                      {learner.completedCount}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <span className="inline-flex items-center text-[#137333] bg-[#E6F4EA] px-2.5 py-0.5 rounded-full gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {learner.passedCount}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-center font-bold text-[#1A73E8]">
                      {learner.hoursSpent} hrs
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button className="text-[#5F6368] group-hover:text-[#1A73E8] p-1.5 rounded-full group-hover:bg-[#E8F0FE] transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
