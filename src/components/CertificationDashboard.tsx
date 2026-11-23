import React from 'react';
import { CertificationStats } from '../types';
import { translateLabel } from '../lib/i18n';
import {
  Award,
  CheckCircle2,
  Compass,
  Ticket,
  ChevronRight,
  Layers,
  Star,
} from 'lucide-react';

interface CertificationDashboardProps {
  stats: CertificationStats | null;
  isLoading: boolean;
  onSelectMember: (email: string) => void;
}

export const CertificationDashboard: React.FC<CertificationDashboardProps> = ({
  stats,
  isLoading,
  onSelectMember,
}) => {
  if (isLoading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#FEF7E0] border-t-[#FBBC04] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Evaluando rutas de aprendizaje y candidatos a certificación...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="google-card p-6 border-l-4 border-l-[#FBBC04]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#B06000] bg-[#FEF7E0] px-2.5 py-0.5 rounded-full">
          Rutas Oficiales e Insignias de Habilidad (Skill Badges)
        </span>
        <h2 className="text-xl font-bold text-[#202124] mt-2">
          Preparación para Certificaciones Google Cloud y Candidatos a Voucher
        </h2>
        <p className="text-xs text-[#5F6368] mt-1">
          Agrupa laboratorios y cursos por su ruta oficial (`Parent Name`) e identifica talento listo para presentar examen de certificación.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#4285F4]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Rutas y Tracks Activos
            </span>
            <div className="p-2 rounded-xl bg-[#E8F0FE] text-[#1A73E8]">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#202124]">{stats.totalPathsTracked}</div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Rutas de especialidad y certificaciones detectadas
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#9334E6]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Módulos en Rutas</span>
            <div className="p-2 rounded-xl bg-[#F3E8FD] text-[#9334E6]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#7627BB]">{stats.totalActivitiesInPaths}</div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Laboratorios y cursos vinculados a rutas estructuradas
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#FBBC04]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Candidatos Listos para Voucher
            </span>
            <div className="p-2 rounded-xl bg-[#FEF7E0] text-[#E37400]">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#E37400]">{stats.certificationReadyCount}</div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Índice de preparación ≥ 80% y laboratorios aprobados
          </div>
        </div>
      </div>

      {/* Paths & Tracks Cards */}
      <div className="google-card p-6">
        <div className="mb-5">
          <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#E37400]" />
            Avance por Ruta de Aprendizaje / Certificación Oficial
          </h3>
          <p className="text-xs text-[#5F6368] mt-0.5">
            Consolidado de estudiantes inscritos, actividades completadas y calificación promedio por ruta
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.pathsOverview.map((path, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED] hover:border-[#AECBFA] hover:bg-white hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3]">
                    {path.isOfficialCertTrack
                      ? 'Track de Certificación'
                      : translateLabel(path.parentType)}
                  </span>
                  <span className="text-[10px] text-[#5F6368] font-medium">
                    {translateLabel(path.category)}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#202124] line-clamp-2 leading-snug">
                  {path.pathName}
                </h4>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E8EAED] grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="block text-[10px] text-[#5F6368]">Alumnos</span>
                  <span className="font-bold text-[#202124]">{path.learnersEnrolled}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[#5F6368]">Completados</span>
                  <span className="font-bold text-[#137333]">{path.activitiesCompleted}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[#5F6368]">Horas</span>
                  <span className="font-bold text-[#1A73E8]">{path.totalHours}h</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Voucher Candidates Table */}
      <div className="google-card overflow-hidden">
        <div className="p-6 border-b border-[#E8EAED]">
          <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
            <Star className="w-4 h-4 text-[#FBBC04]" />
            Tabla de Elegibilidad para Patrocinio de Examen (Voucher Readiness)
          </h3>
          <p className="text-xs text-[#5F6368] mt-0.5">
            Clasifica a los colaboradores según el volumen de módulos completados y precisión de aprobación en su ruta principal
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8EAED] bg-[#F8FAFD] text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider">
                <th className="py-3.5 px-6">Candidato</th>
                <th className="py-3.5 px-6">Equipo</th>
                <th className="py-3.5 px-6">Certificación / Ruta Objetivo</th>
                <th className="py-3.5 px-6 text-center">Módulos Aprobados</th>
                <th className="py-3.5 px-6 text-center">Promedio</th>
                <th className="py-3.5 px-6 text-center">Preparación</th>
                <th className="py-3.5 px-6 text-center">Recomendación</th>
                <th className="py-3.5 px-6 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED] text-xs">
              {stats.voucherCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#5F6368]">
                    Aún no hay candidatos con progreso registrado en rutas de certificación.
                  </td>
                </tr>
              ) : (
                stats.voucherCandidates.map((cand) => (
                  <tr
                    key={cand.email}
                    onClick={() => onSelectMember(cand.email)}
                    className="hover:bg-[#F8FAFD] cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-6">
                      <div className="font-semibold text-[#202124] group-hover:text-[#1A73E8] transition-colors">
                        {cand.name}
                      </div>
                      <div className="text-[11px] font-mono text-[#5F6368]">{cand.email}</div>
                    </td>
                    <td className="py-3.5 px-6 text-[#3C4043]">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#F1F3F4] border border-[#DADCE0] text-[11px] font-medium">
                        {translateLabel(cand.team_name)}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-[#202124] font-medium max-w-xs">
                      <span className="line-clamp-1">{cand.targetTrack}</span>
                    </td>
                    <td className="py-3.5 px-6 text-center font-mono text-[#3C4043]">
                      <span className="text-[#137333] font-bold">{cand.passedModules}</span> /{' '}
                      {cand.completedModules}
                      <span className="block text-[10px] text-[#5F6368]">
                        {cand.hoursSpent} hrs
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-center font-bold text-[#202124]">
                      {cand.avgScore}%
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="w-28 mx-auto">
                        <div className="flex justify-between text-[10px] font-mono mb-1">
                          <span className="text-[#5F6368]">Índice</span>
                          <span className="text-[#202124] font-bold">{cand.readinessScore}%</span>
                        </div>
                        <div className="w-full bg-[#F1F3F4] h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              cand.readinessScore >= 80
                                ? 'bg-[#34A853]'
                                : cand.readinessScore >= 50
                                ? 'bg-[#FBBC04]'
                                : 'bg-[#4285F4]'
                            }`}
                            style={{ width: `${cand.readinessScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      {cand.status === 'Listo para Voucher' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
                          <CheckCircle2 className="w-3 h-3" />
                          Listo para Voucher
                        </span>
                      )}
                      {cand.status === 'En Progreso Avanzado' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3]">
                          En Progreso Avanzado
                        </span>
                      )}
                      {cand.status === 'Inicial' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F1F3F4] text-[#5F6368] border border-[#DADCE0]">
                          Etapa Inicial
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button className="text-[#5F6368] group-hover:text-[#1A73E8] p-1.5 rounded-full group-hover:bg-[#E8F0FE]">
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
