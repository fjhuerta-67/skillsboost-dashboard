import React, { useState, useEffect } from 'react';
import { TalentDirectoryResponse } from '../types';
import { translateLabel } from '../lib/i18n';
import {
  Search,
  CheckCircle2,
  Mail,
  ChevronRight,
  Code2,
} from 'lucide-react';

interface TalentFinderDashboardProps {
  initialData: TalentDirectoryResponse | null;
  onSelectMember: (email: string) => void;
}

export const TalentFinderDashboard: React.FC<TalentFinderDashboardProps> = ({
  initialData,
  onSelectMember,
}) => {
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState<TalentDirectoryResponse | null>(initialData);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (initialData && !directory) {
      setDirectory(initialData);
    }
  }, [initialData, directory]);

  const executeSearch = async (skillQuery: string) => {
    setQuery(skillQuery);
    setSearching(true);
    try {
      const res = await fetch(`/api/analytics/talent?q=${encodeURIComponent(skillQuery)}`);
      const data = await res.json();
      if (data.ok && data.directory) {
        setDirectory(data.directory);
      }
    } catch (err) {
      console.error('Error buscando talento interno:', err);
    } finally {
      setSearching(false);
    }
  };

  if (!directory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#E8F0FE] border-t-[#1A73E8] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Indexando directorio de especialistas y campeones internos...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Google-style Search Bar */}
      <div className="google-card p-6 space-y-5 border-l-4 border-l-[#4285F4]">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1967D2] bg-[#E8F0FE] px-2.5 py-0.5 rounded-full">
            Directorio de Expertos Verificados (SMEs & Champions)
          </span>
          <h2 className="text-xl font-bold text-[#202124] mt-2">
            Buscador de Talento Interno y Mentores Cloud
          </h2>
          <p className="text-xs text-[#5F6368] mt-1">
            Encuentra colaboradores de la organización con práctica comprobada en tecnologías específicas para integrar células de proyecto o mentorías internas.
          </p>
        </div>

        {/* Google Search Pill Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeSearch(query);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#4285F4]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca una habilidad o tecnología (ej. BigQuery, Looker, Vertex AI, Cloud SQL, IAM, Kubernetes)..."
              className="w-full bg-white border border-[#DADCE0] rounded-full pl-11 pr-4 py-2.5 text-xs text-[#202124] placeholder-[#5F6368] shadow-2xs focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE] transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold transition-all shadow-sm shrink-0 cursor-pointer"
          >
            {searching ? 'Buscando...' : 'Buscar Especialistas'}
          </button>
          {query && (
            <button
              type="button"
              onClick={() => executeSearch('')}
              className="px-4 py-2.5 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#3C4043] text-xs font-medium shrink-0 cursor-pointer"
            >
              Ver Todos
            </button>
          )}
        </form>

        {/* Quick Skill Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E8EAED]">
          <span className="text-[11px] text-[#5F6368] font-medium flex items-center gap-1">
            <Code2 className="w-3.5 h-3.5 text-[#1A73E8]" />
            Tecnologías detectadas:
          </span>
          {directory.popularSkills.map((s) => (
            <button
              key={s.skill}
              onClick={() => executeSearch(s.skill === query ? '' : s.skill)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                query.toLowerCase() === s.skill.toLowerCase()
                  ? 'bg-[#1A73E8] text-white border-[#1A73E8]'
                  : 'bg-[#F8FAFD] text-[#3C4043] border-[#DADCE0] hover:bg-[#E8F0FE] hover:text-[#174EA6] hover:border-[#AECBFA]'
              }`}
            >
              {s.skill} <span className="text-[10px] opacity-75 font-mono">({s.expertsCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results Grid */}
      {directory.experts.length === 0 ? (
        <div className="google-card p-12 text-center text-[#5F6368] text-sm">
          Ningún colaborador registra aún módulos completados para <strong>"{query}"</strong>. Puedes diseñar una ruta en la pestaña <strong>Rutas con IA</strong>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {directory.experts.map((exp) => (
            <div
              key={exp.email}
              className="google-card p-6 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                        exp.championTier === 'Champion Oro'
                          ? 'bg-[#FEF7E0] text-[#B06000] border-[#FDD663]'
                          : exp.championTier === 'Especialista Plata'
                          ? 'bg-[#E8F0FE] text-[#1967D2] border-[#AECBFA]'
                          : 'bg-[#F1F3F4] text-[#5F6368] border-[#DADCE0]'
                      }`}
                    >
                      {exp.championTier === 'Champion Oro'
                        ? '🥇 '
                        : exp.championTier === 'Especialista Plata'
                        ? '🥈 '
                        : '🥉 '}
                      {exp.championTier}
                    </span>
                    <h3 className="text-base font-bold text-[#202124] mt-2">{exp.name}</h3>
                    <p className="text-xs text-[#5F6368]">
                      {translateLabel(exp.team_name)} •{' '}
                      <span className="font-mono text-[11px]">{exp.email}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-lg font-bold text-[#1A73E8] font-mono">
                      {exp.relevantHours} hrs
                    </span>
                    <span className="block text-[10px] text-[#5F6368]">
                      {exp.matchingModulesCount} mód. • {exp.avgScore}% prom.
                    </span>
                  </div>
                </div>

                {/* Top Skills */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {exp.topSkills.map((sk) => (
                    <span
                      key={sk}
                      className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#F8FAFD] border border-[#E8EAED] text-[#3C4043] font-medium"
                    >
                      {translateLabel(sk)}
                    </span>
                  ))}
                </div>

                {/* Verified Credentials List */}
                <div className="mt-4 pt-3 border-t border-[#E8EAED] space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-[#5F6368] font-bold block">
                    Evidencia Práctica Verificada:
                  </span>
                  {exp.verifiedActivities.slice(0, 3).map((act, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[11px] text-[#3C4043] gap-2"
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#34A853] shrink-0" />
                        <span className="truncate">{act.name}</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#5F6368] shrink-0">
                        {act.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-[#E8EAED] flex items-center justify-between">
                <a
                  href={`mailto:${exp.email}?subject=${encodeURIComponent(
                    'Invitación como Mentor / Especialista Cloud — Google Skills'
                  )}`}
                  className="inline-flex items-center gap-1.5 text-xs text-[#3C4043] hover:text-[#1A73E8] px-3.5 py-1.5 rounded-full bg-[#F1F3F4] hover:bg-[#E8F0FE] font-medium transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#1A73E8]" />
                  <span>Contactar Mentor</span>
                </a>

                <button
                  onClick={() => onSelectMember(exp.email)}
                  className="inline-flex items-center gap-1 text-xs text-[#1A73E8] hover:text-[#1557B0] font-semibold cursor-pointer"
                >
                  <span>Expediente Completo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
