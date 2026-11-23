import React from 'react';
import { SkillMatrixStats } from '../types';
import { translateLabel } from '../lib/i18n';
import { Grid3X3, AlertOctagon, ShieldCheck, BarChart2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface SkillMatrixDashboardProps {
  matrix: SkillMatrixStats | null;
  isLoading: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  introductory: '#4285F4',
  intermediate: '#34A853',
  advanced: '#9334E6',
};

const CATEGORY_ACCENTS = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9334E6', '#12B5CB'];

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#DADCE0',
  borderRadius: '12px',
  fontSize: '12px',
  color: '#202124',
  boxShadow: '0 4px 14px rgba(60, 64, 67, 0.12)',
};

export const SkillMatrixDashboard: React.FC<SkillMatrixDashboardProps> = ({
  matrix,
  isLoading,
}) => {
  if (isLoading || !matrix) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#F3E8FD] border-t-[#9334E6] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Calculando mapa de calor de habilidades y madurez técnica...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="google-card p-6 border-l-4 border-l-[#9334E6]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#7627BB] bg-[#F3E8FD] px-2.5 py-0.5 rounded-full">
          Diagnóstico de Competencias Cloud e IA
        </span>
        <h2 className="text-xl font-bold text-[#202124] mt-2">
          Matriz de Habilidades (Equipos × Dominios) y Brechas de Conocimiento
        </h2>
        <p className="text-xs text-[#5F6368] mt-1">
          Cruza el esfuerzo real de cada equipo contra las categorías tecnológicas del catálogo para detectar fortalezas y áreas en cero.
        </p>
      </div>

      {/* Category Coverage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {matrix.categoryTotals.map((cat, idx) => {
          const accent = CATEGORY_ACCENTS[idx % CATEGORY_ACCENTS.length];
          return (
            <div
              key={cat.category}
              className="google-card p-5 flex flex-col justify-between relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: accent }}
              />
              <div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-[#202124]">
                    {translateLabel(cat.category)}
                  </span>
                  <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#F3E8FD] text-[#7627BB] border border-[#D7AEFB]">
                    {cat.coverageRate}% cobertura
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#1A73E8]">{cat.hours} hrs</span>
                  <span className="text-xs text-[#5F6368]">({cat.count} actividades)</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[#E8EAED]">
                <div className="flex items-center justify-between text-[11px] text-[#5F6368] mb-1.5">
                  <span>Equipos con presencia</span>
                  <span className="font-mono font-semibold text-[#202124]">
                    {cat.teamsCovered} / {cat.totalTeams} equipos
                  </span>
                </div>
                <div className="w-full bg-[#F1F3F4] h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(cat.coverageRate, 4)}%`,
                      backgroundColor: accent,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Heatmap Table: Teams x Categories */}
      <div className="google-card overflow-hidden">
        <div className="p-6 border-b border-[#E8EAED] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-[#9334E6]" />
              Mapa de Calor: Intensidad de Capacitación por Equipo y Dominio
            </h3>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Las celdas grises (`0h`) representan brechas de conocimiento sin actividad registrada en ese equipo
            </p>
          </div>

          <div className="flex items-center space-x-2 text-[10px] text-[#5F6368] font-medium">
            <span>Brecha (0h)</span>
            <span className="w-3.5 h-3.5 rounded bg-[#F1F3F4] border border-[#DADCE0] inline-block" />
            <span className="w-3.5 h-3.5 rounded bg-[#D2E3FC] inline-block" />
            <span className="w-3.5 h-3.5 rounded bg-[#8AB4F8] inline-block" />
            <span className="w-3.5 h-3.5 rounded bg-[#1A73E8] inline-block" />
            <span>Dominio Alto</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8EAED] bg-[#F8FAFD] text-[10px] font-semibold text-[#5F6368] uppercase tracking-wider">
                <th className="py-3.5 px-4 min-w-[200px]">Equipo / Unidad</th>
                <th className="py-3.5 px-3 text-center">Horas</th>
                {matrix.categories.map((cat) => (
                  <th key={cat} className="py-3.5 px-3 text-center min-w-[125px]">
                    {translateLabel(cat)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED] text-xs">
              {matrix.heatmapRows.map((row) => (
                <tr key={row.team_slug} className="hover:bg-[#F8FAFD]/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#202124]">{row.team_name}</div>
                    <div className="text-[10px] text-[#5F6368]">{row.member_count} integrantes</div>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-[#1A73E8]">
                    {row.totalHours}h
                  </td>
                  {row.cells.map((cell) => {
                    const hasActivity = cell.count > 0;
                    const highIntensity = cell.intensity >= 52;
                    const bgAlpha = hasActivity ? Math.max(0.14, cell.intensity / 100) : 0;
                    return (
                      <td key={cell.category} className="p-2 text-center">
                        {hasActivity ? (
                          <div
                            className={`rounded-xl py-2 px-2 border transition-transform hover:scale-[1.03] ${
                              highIntensity
                                ? 'border-[#1967D2] text-white'
                                : 'border-[#AECBFA] text-[#174EA6]'
                            }`}
                            style={{
                              backgroundColor: `rgba(26, 115, 232, ${bgAlpha})`,
                            }}
                          >
                            <div className="font-bold text-xs">{cell.hours}h</div>
                            <div
                              className={`text-[10px] ${
                                highIntensity ? 'text-[#E8F0FE]' : 'text-[#1967D2]'
                              }`}
                            >
                              {cell.count} mód.
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl py-2 px-2 bg-[#F8F9FA] border border-[#E8EAED] text-[#9AA0A6]">
                            <div className="font-mono text-[11px]">0h</div>
                            <div className="text-[9px] uppercase font-medium">Brecha</div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Technical Maturity & Critical Skill Gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Technical Depth / Maturity */}
        <div className="google-card p-6">
          <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#1A73E8]" />
            Índice de Madurez y Profundidad Técnica
          </h3>
          <p className="text-xs text-[#5F6368] mt-0.5 mb-6">
            Proporción de aprendizaje entre fundamentos introductorios, práctica intermedia y arquitectura avanzada
          </p>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={matrix.levelDistribution.map((d) => ({
                  ...d,
                  label: translateLabel(d.level),
                }))}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EAED" />
                <XAxis dataKey="label" stroke="#3C4043" fontSize={12} />
                <YAxis stroke="#5F6368" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Actividades Realizadas" radius={[8, 8, 0, 0]}>
                  {matrix.levelDistribution.map((entry) => (
                    <Cell key={entry.level} fill={LEVEL_COLORS[entry.level] || '#4285F4'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#E8EAED]">
            {matrix.levelDistribution.map((lvl) => (
              <div
                key={lvl.level}
                className="text-center p-2.5 rounded-xl bg-[#F8FAFD] border border-[#E8EAED]"
              >
                <div className="text-[11px] text-[#5F6368] font-medium">
                  {translateLabel(lvl.level)}
                </div>
                <div className="text-lg font-bold text-[#202124] mt-0.5">{lvl.percentage}%</div>
                <div className="text-[10px] text-[#5F6368] font-mono">{lvl.hours} hrs</div>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Gaps Summary */}
        <div className="google-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-[#EA4335]" />
              Radar de Brechas Críticas por Equipo
            </h3>
            <p className="text-xs text-[#5F6368] mt-0.5 mb-4">
              Dominios tecnológicos donde cada equipo aún registra 0 actividades completadas
            </p>

            <div className="space-y-3 max-h-[310px] overflow-y-auto pr-1">
              {matrix.criticalGaps.length === 0 ? (
                <div className="p-6 text-center text-[#137333] bg-[#E6F4EA] rounded-2xl text-xs flex flex-col items-center gap-2">
                  <ShieldCheck className="w-8 h-8 text-[#34A853]" />
                  <span className="font-semibold">
                    ¡Todos los equipos tienen cobertura en todos los dominios del catálogo!
                  </span>
                </div>
              ) : (
                matrix.criticalGaps.map((gap) => (
                  <div
                    key={gap.team_name}
                    className="p-3.5 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#202124]">
                        {gap.team_name}
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-[#C5221F]">
                        {gap.missingCategories.length} dominios pendientes
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {gap.missingCategories.map((cat) => (
                        <span
                          key={cat}
                          className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF] font-medium"
                        >
                          {translateLabel(cat)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
