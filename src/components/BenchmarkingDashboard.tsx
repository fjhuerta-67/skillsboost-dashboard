import React from 'react';
import { BenchmarkingStats } from '../types';
import {
  Trophy,
  BarChart3,
  Clock,
  Flame,
  Gauge,
  CheckCircle2,
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

interface BenchmarkingDashboardProps {
  stats: BenchmarkingStats | null;
  isLoading: boolean;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#DADCE0',
  borderRadius: '12px',
  fontSize: '12px',
  color: '#202124',
  boxShadow: '0 4px 14px rgba(60, 64, 67, 0.12)',
};

export const BenchmarkingDashboard: React.FC<BenchmarkingDashboardProps> = ({
  stats,
  isLoading,
}) => {
  if (isLoading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#FEF7E0] border-t-[#FBBC04] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Comparando eficiencia, velocidad y participación entre equipos...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="google-card p-6 border-l-4 border-l-[#FBBC04]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#B06000] bg-[#FEF7E0] px-2.5 py-0.5 rounded-full">
          Evaluación Comparativa Organizacional
        </span>
        <h2 className="text-xl font-bold text-[#202124] mt-2">
          Comparador Ejecutivo de Equipos y Análisis de Fricción en Laboratorios
        </h2>
        <p className="text-xs text-[#5F6368] mt-1">
          Compara lado a lado las {stats.rankings.length} unidades en participación activa, horas promedio e índice de eficiencia técnica.
        </p>
      </div>

      {/* Org Baseline KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#4285F4]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Promedio Org: Horas / Miembro
            </span>
            <div className="p-2 rounded-xl bg-[#E8F0FE] text-[#1A73E8]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124]">
            {stats.orgAvgHoursPerMember}{' '}
            <span className="text-lg font-normal text-[#5F6368]">hrs</span>
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Línea base promedio entre todos los equipos
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#34A853]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Promedio Org: Participación
            </span>
            <div className="p-2 rounded-xl bg-[#E6F4EA] text-[#1E8E3E]">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#137333]">{stats.orgAvgAdoptionRate}%</div>
          <div className="mt-2 text-xs text-[#5F6368]">
            % promedio de plantilla activa por gerencia
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#9334E6]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Promedio Org: Aprobación
            </span>
            <div className="p-2 rounded-xl bg-[#F3E8FD] text-[#9334E6]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#7627BB]">{stats.orgAvgPassRate}%</div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Efectividad técnica en evaluaciones y labs
          </div>
        </div>
      </div>

      {/* Comparative Chart */}
      <div className="google-card p-6">
        <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#1A73E8]" />
          Comparativa Lado a Lado: Índice de Eficiencia vs. % de Participación
        </h3>
        <p className="text-xs text-[#5F6368] mt-0.5 mb-6">
          El Índice de Eficiencia (0–100) pondera participación activa (40%), velocidad en horas (35%) y calidad de aprobación (25%)
        </p>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stats.rankings.map((r) => ({
                ...r,
                shortName:
                  r.team_name.length > 18 ? `${r.team_name.slice(0, 18)}…` : r.team_name,
              }))}
              margin={{ top: 10, right: 20, left: 0, bottom: 35 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E8EAED" />
              <XAxis
                dataKey="shortName"
                stroke="#3C4043"
                fontSize={10}
                angle={-20}
                textAnchor="end"
                interval={0}
              />
              <YAxis stroke="#5F6368" fontSize={11} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                formatter={(v) => (
                  <span className="text-xs text-[#3C4043] font-medium">{v}</span>
                )}
              />
              <Bar
                dataKey="efficiencyScore"
                name="Índice de Eficiencia (0-100)"
                fill="#4285F4"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="participationRate"
                name="% Participación Activa"
                fill="#34A853"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Side-by-side League Table & Friction Labs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* League Ranking Table (2 cols) */}
        <div className="google-card overflow-hidden lg:col-span-2">
          <div className="p-6 border-b border-[#E8EAED]">
            <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#FBBC04]" />
              Clasificación General entre Unidades / Gerencias
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8EAED] bg-[#F8FAFD] text-[10px] font-semibold text-[#5F6368] uppercase tracking-wider">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Equipo</th>
                  <th className="py-3 px-4 text-center">Activos / Total</th>
                  <th className="py-3 px-4 text-center">Hrs / Miembro</th>
                  <th className="py-3 px-4 text-center">Hrs / Activo</th>
                  <th className="py-3 px-4 text-center">Aprobación</th>
                  <th className="py-3 px-4 text-right">Eficiencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED] text-xs">
                {stats.rankings.map((row) => (
                  <tr key={row.team_slug} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3 px-4 font-mono text-[#5F6368] font-semibold">
                      {row.rank === 1
                        ? '🥇'
                        : row.rank === 2
                        ? '🥈'
                        : row.rank === 3
                        ? '🥉'
                        : `#${row.rank}`}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#202124]">{row.team_name}</td>
                    <td className="py-3 px-4 text-center font-mono text-[#3C4043]">
                      <span className="text-[#137333] font-bold">{row.activeLearners}</span> /{' '}
                      {row.member_count}{' '}
                      <span className="text-[10px] text-[#5F6368]">
                        ({row.participationRate}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-[#1A73E8]">
                      {row.avgHoursPerMember}h
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[#3C4043]">
                      {row.avgHoursPerActiveLearner}h
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-[#202124]">
                      {row.passRate}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] border ${
                          row.efficiencyScore >= 60
                            ? 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]'
                            : row.efficiencyScore >= 25
                            ? 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]'
                            : 'bg-[#F1F3F4] text-[#5F6368] border-[#DADCE0]'
                        }`}
                      >
                        {row.efficiencyScore} pts
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Friction Labs (1 col) */}
        <div className="google-card p-6">
          <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#EA4335]" />
            Índice de Fricción en Laboratorios
          </h3>
          <p className="text-xs text-[#5F6368] mt-0.5 mb-4">
            Detecta laboratorios con mayor tiempo invertido o intentos fallidos
          </p>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {stats.frictionLabs.map((lab, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED] space-y-1.5 hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      lab.frictionLevel === 'Alta'
                        ? 'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]'
                        : lab.frictionLevel === 'Media'
                        ? 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]'
                        : 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]'
                    }`}
                  >
                    Fricción {lab.frictionLevel}
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-[#1A73E8]">
                    {lab.avgActualMinutes} min reales
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-[#202124] line-clamp-2">{lab.name}</h4>
                <div className="flex items-center justify-between text-[10px] text-[#5F6368] pt-1">
                  <span>
                    {lab.attempts} intentos ({lab.failCount} no aprob.)
                  </span>
                  <span className="font-semibold text-[#3C4043]">Prom: {lab.avgScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
