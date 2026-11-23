import React, { useState } from 'react';
import { GamificationStats } from '../types';
import { translateLabel } from '../lib/i18n';
import {
  Crown,
  Trophy,
  Zap,
  Copy,
  Check,
} from 'lucide-react';

interface GamificationLeagueProps {
  stats: GamificationStats | null;
  isLoading: boolean;
  onSelectMember: (email: string) => void;
}

export const GamificationLeague: React.FC<GamificationLeagueProps> = ({
  stats,
  isLoading,
  onSelectMember,
}) => {
  const [copiedCard, setCopiedCard] = useState<string | null>(null);

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#FEF7E0] border-t-[#FBBC04] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Calculando puntos XP, insignias y Muro de Honor...
        </p>
      </div>
    );
  }

  const copyRecognition = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCard(key);
    setTimeout(() => setCopiedCard(null), 2000);
  };

  const { hallOfFame } = stats;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Banner Header */}
      <div className="google-card p-6 bg-gradient-to-r from-[#FEF7E0]/75 via-white to-[#E8F0FE]/75 border-l-4 border-l-[#FBBC04] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#B06000] bg-[#FEF7E0] px-2.5 py-0.5 rounded-full border border-[#FEEFC3]">
            {stats.sprintPeriod} • Gamificación Corporativa
          </span>
          <h2 className="text-xl font-bold text-[#202124] mt-2 flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#F9AB00]" />
            {stats.sprintName} — Liga de Puntos XP y Muro de Honor
          </h2>
          <p className="text-xs text-[#3C4043] mt-1">
            Reglas oficiales: Laboratorio aprobado = <strong>+150 XP</strong> • Curso ={' '}
            <strong>+100 XP</strong> • Calificación perfecta (100%) = <strong>+50 XP bono</strong> •
            Hora invertida = <strong>+25 XP</strong>.
          </p>
        </div>
      </div>

      {/* Hall of Fame Spotlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Learner of the Month — Google Yellow */}
        {hallOfFame.learnerOfTheMonth && (
          <div className="google-card p-6 border border-[#FDD663] bg-gradient-to-b from-[#FEF7E0]/85 to-white flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FEF7E0] text-[#B06000] border border-[#FDD663]">
                  🏆 Estudiante del Mes
                </span>
                <span className="text-lg font-mono font-extrabold text-[#E37400]">
                  {hallOfFame.learnerOfTheMonth.points} XP
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#202124] mt-3">
                {hallOfFame.learnerOfTheMonth.name}
              </h3>
              <p className="text-xs text-[#5F6368]">
                {translateLabel(hallOfFame.learnerOfTheMonth.team)} •{' '}
                {hallOfFame.learnerOfTheMonth.hours} hrs acumuladas
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {hallOfFame.learnerOfTheMonth.badges.map((b) => (
                  <span
                    key={b}
                    className="text-[10px] px-2.5 py-0.5 rounded-full bg-white border border-[#DADCE0] text-[#3C4043] font-medium"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() =>
                copyRecognition(
                  'mvp',
                  `🏆 ¡Reconocimiento Google Skills!\nFelicitamos a *${hallOfFame.learnerOfTheMonth!.name}* (${translateLabel(
                    hallOfFame.learnerOfTheMonth!.team
                  )}) por liderar la Liga Google Skills con *${hallOfFame.learnerOfTheMonth!.points} XP* y *${hallOfFame.learnerOfTheMonth!.hours} horas* de aprendizaje práctico. ¡Gracias por inspirar al equipo! 🚀`
                )
              }
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full bg-[#F9AB00] hover:bg-[#E37400] text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              {copiedCard === 'mvp' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>
                {copiedCard === 'mvp'
                  ? 'Felicitación Copiada'
                  : 'Copiar Tarjeta de Reconocimiento'}
              </span>
            </button>
          </div>
        )}

        {/* Fastest Team — Google Blue */}
        {hallOfFame.fastestTeam && (
          <div className="google-card p-6 border border-[#AECBFA] bg-gradient-to-b from-[#E8F0FE]/85 to-white flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2] border border-[#AECBFA]">
                  🚀 Escuadrón Líder
                </span>
                <span className="text-lg font-mono font-extrabold text-[#1A73E8]">
                  {hallOfFame.fastestTeam.points} XP
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#202124] mt-3">
                {hallOfFame.fastestTeam.team_name}
              </h3>
              <p className="text-xs text-[#5F6368] mt-1">
                Promedio de <strong>{hallOfFame.fastestTeam.avgPointsPerMember} XP</strong> por integrante con{' '}
                {hallOfFame.fastestTeam.activeMembers} jugadores activos.
              </p>
            </div>

            <button
              onClick={() =>
                copyRecognition(
                  'team',
                  `🚀 ¡Escuadrón Líder de la Semana!\nEl equipo *${hallOfFame.fastestTeam!.team_name}* encabeza la Liga Google Skills acumulando *${hallOfFame.fastestTeam!.points} XP*. ¡Excelente ritmo de transformación digital!`
                )
              }
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              {copiedCard === 'team' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>
                {copiedCard === 'team' ? 'Reconocimiento Copiado' : 'Compartir Logro de Equipo'}
              </span>
            </button>
          </div>
        )}

        {/* Lab Master — Google Green */}
        {hallOfFame.labMaster && (
          <div className="google-card p-6 border border-[#A8DAB5] bg-gradient-to-b from-[#E6F4EA]/85 to-white flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] border border-[#A8DAB5]">
                  ⚡ Maestro de Laboratorios
                </span>
                <span className="text-lg font-mono font-extrabold text-[#1E8E3E]">
                  {hallOfFame.labMaster.labsPassed} Labs
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#202124] mt-3">
                {hallOfFame.labMaster.name}
              </h3>
              <p className="text-xs text-[#5F6368] mt-1">
                {translateLabel(hallOfFame.labMaster.team)} • Precisión técnica promedio de{' '}
                <strong>{hallOfFame.labMaster.avgScore}%</strong> en entornos reales de consola GCP.
              </p>
            </div>

            <button
              onClick={() =>
                copyRecognition(
                  'lab',
                  `⚡ ¡Maestro de Laboratorios Cloud!\nReconocemos a *${hallOfFame.labMaster!.name}* por aprobar *${hallOfFame.labMaster!.labsPassed} laboratorios prácticos* con un promedio sobresaliente de *${hallOfFame.labMaster!.avgScore}%*.`
                )
              }
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full bg-[#1E8E3E] hover:bg-[#137333] text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              {copiedCard === 'lab' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>
                {copiedCard === 'lab' ? 'Felicitación Copiada' : 'Copiar Mención Especial'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Individual XP League & Team League */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Individual XP Leaderboard (2 cols) */}
        <div className="google-card overflow-hidden lg:col-span-2">
          <div className="p-6 border-b border-[#E8EAED]">
            <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#F9AB00]" />
              Tabla General de Jugadores (Puntos XP e Insignias)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8EAED] bg-[#F8FAFD] text-[10px] font-semibold text-[#5F6368] uppercase tracking-wider">
                  <th className="py-3 px-4">Pos</th>
                  <th className="py-3 px-4">Participante</th>
                  <th className="py-3 px-4 text-center">Labs / Cursos</th>
                  <th className="py-3 px-4">Insignias Desbloqueadas</th>
                  <th className="py-3 px-4 text-right">Puntos XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED] text-xs">
                {stats.individualLeague.map((p) => (
                  <tr
                    key={p.email}
                    onClick={() => onSelectMember(p.email)}
                    className="hover:bg-[#F8FAFD] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#5F6368]">
                      {p.rank === 1
                        ? '🥇'
                        : p.rank === 2
                        ? '🥈'
                        : p.rank === 3
                        ? '🥉'
                        : `#${p.rank}`}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#202124]">{p.name}</div>
                      <div className="text-[10px] text-[#5F6368]">{translateLabel(p.team)}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-[#3C4043]">
                      <span className="text-[#137333] font-bold">{p.labsPassed}L</span> /{' '}
                      {p.coursesCompleted}C
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {p.badges.map((b) => (
                          <span
                            key={b}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8FAFD] border border-[#DADCE0] text-[#3C4043] font-medium"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#E37400]">
                      {p.points.toLocaleString()} XP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team League Standings (1 col) */}
        <div className="google-card p-6 space-y-4">
          <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#1A73E8]" />
            Copa por Equipos
          </h3>
          <p className="text-xs text-[#5F6368]">
            Clasificación acumulada de puntos XP entre las gerencias registradas
          </p>

          <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
            {stats.teamLeague.map((t) => (
              <div
                key={t.team_name}
                className="p-3.5 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED] flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-semibold text-[#202124] truncate">
                    {t.rank === 1
                      ? '🥇 '
                      : t.rank === 2
                      ? '🥈 '
                      : t.rank === 3
                      ? '🥉 '
                      : `#${t.rank} `}
                    {t.team_name}
                  </div>
                  <span className="text-[10px] text-[#5F6368]">
                    {t.avgPointsPerMember} XP/persona • {t.badgesCount} insignias
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-[#1A73E8] shrink-0">
                  {t.totalPoints.toLocaleString()} XP
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
