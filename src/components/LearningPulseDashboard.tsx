import React from 'react';
import { LearningPulseStats } from '../types';
import {
  Clock,
  Sun,
  Moon,
  CalendarDays,
  Lightbulb,
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
} from 'recharts';

interface LearningPulseDashboardProps {
  pulse: LearningPulseStats | null;
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

export const LearningPulseDashboard: React.FC<LearningPulseDashboardProps> = ({
  pulse,
  isLoading,
}) => {
  if (isLoading || !pulse) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#E6F4EA] border-t-[#34A853] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Analizando ventanas horarias y hábitos de estudio...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="google-card p-6 border-l-4 border-l-[#34A853]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#137333] bg-[#E6F4EA] px-2.5 py-0.5 rounded-full">
          Bienestar, Ritmo y Cultura de Aprendizaje (Horario Local Corporativo)
        </span>
        <h2 className="text-xl font-bold text-[#202124] mt-2">
          Pulso de Aprendizaje y Mapa de Calor de Ventanas Horarias
        </h2>
        <p className="text-xs text-[#5F6368] mt-1">
          Descubre en qué días y franjas horarias se capacitan realmente los equipos para diseñar bloques de aprendizaje protegido sin fatiga laboral.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#34A853]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              En Horario Laboral
            </span>
            <div className="p-2 rounded-xl bg-[#E6F4EA] text-[#1E8E3E]">
              <Sun className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#137333]">{pulse.workHoursPercentage}%</div>
          <div className="mt-2 text-xs text-[#5F6368]">Lunes a Viernes (08:00 – 19:00 hrs)</div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#4285F4]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Fuera de Horario</span>
            <div className="p-2 rounded-xl bg-[#E8F0FE] text-[#1A73E8]">
              <Moon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#1A73E8]">{pulse.afterHoursPercentage}%</div>
          <div className="mt-2 text-xs text-[#5F6368]">Noches / madrugadas entre semana</div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#FBBC04]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Fines de Semana</span>
            <div className="p-2 rounded-xl bg-[#FEF7E0] text-[#E37400]">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#E37400]">{pulse.weekendPercentage}%</div>
          <div className="mt-2 text-xs text-[#5F6368]">Sesiones en Sábado y Domingo</div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#EA4335]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ventana Pico</span>
            <div className="p-2 rounded-xl bg-[#FCE8E6] text-[#D93025]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-[#202124]">{pulse.peakDayName}</div>
          <div className="mt-1 text-xs text-[#1A73E8] font-mono font-semibold">
            {pulse.peakHourBlock}
          </div>
          <div className="mt-1 text-[11px] text-[#5F6368]">
            Duración prom: {pulse.avgSessionMinutes} min
          </div>
        </div>
      </div>

      {/* Policy Recommendation Banner */}
      <div className="google-card p-5 bg-[#E6F4EA]/65 border border-[#CEEAD6] flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-white text-[#1E8E3E] border border-[#CEEAD6] shadow-2xs shrink-0">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#137333]">
            Recomendación de Política Organizacional de Tiempo Protegido
          </h4>
          <p className="text-xs sm:text-sm text-[#202124] mt-1 leading-relaxed">
            {pulse.policyRecommendation}
          </p>
        </div>
      </div>

      {/* Day x Hour Block Heatmap & Day BarChart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7x6 Heatmap Grid (2 cols) */}
        <div className="google-card p-6 lg:col-span-2">
          <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#1E8E3E]" />
            Mapa de Calor Semanal (Día × Franja Horaria)
          </h3>
          <p className="text-xs text-[#5F6368] mt-0.5 mb-5">
            Frecuencia exacta de inicio de laboratorios y cursos a lo largo de la semana
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="text-[10px] font-mono font-semibold text-[#5F6368]">
                  <th className="py-2 px-3 text-left">Día</th>
                  {pulse.hourBlocks.map((b) => (
                    <th key={b} className="py-2 px-2">
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs">
                {pulse.heatmapGrid.map((row) => (
                  <tr key={row.day} className="border-t border-[#E8EAED]">
                    <td className="py-2.5 px-3 text-left font-semibold text-[#202124]">
                      {row.day}
                    </td>
                    {row.blocks.map((cell) => {
                      const active = cell.count > 0;
                      const high = cell.intensity >= 55;
                      const alpha = active ? Math.max(0.16, cell.intensity / 100) : 0;
                      return (
                        <td key={cell.block} className="p-1.5">
                          <div
                            className={`rounded-xl py-2.5 font-mono text-xs transition-all ${
                              active
                                ? high
                                  ? 'text-white font-bold border border-[#1E8E3E]'
                                  : 'text-[#137333] font-bold border border-[#A8DAB5]'
                                : 'bg-[#F8F9FA] text-[#9AA0A6] border border-[#E8EAED]'
                            }`}
                            style={
                              active
                                ? { backgroundColor: `rgba(52, 168, 83, ${alpha})` }
                                : undefined
                            }
                          >
                            {cell.count}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Hours by Day of Week Chart (1 col) */}
        <div className="google-card p-6">
          <h3 className="text-base font-bold text-[#202124] mb-1">Horas Acumuladas por Día</h3>
          <p className="text-xs text-[#5F6368] mb-5">Distribución total de horas de capacitación</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pulse.dayDistribution.map((d) => ({
                  ...d,
                  shortDay: d.day.slice(0, 3),
                }))}
                margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EAED" />
                <XAxis dataKey="shortDay" stroke="#3C4043" fontSize={11} />
                <YAxis stroke="#5F6368" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar
                  dataKey="hours"
                  name="Horas Totales"
                  fill="#34A853"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
