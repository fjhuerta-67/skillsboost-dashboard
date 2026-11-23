import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  User,
  ArrowUpRight,
  BookOpen,
  RefreshCw,
  Lightbulb,
  ShieldCheck,
  Award,
  Briefcase,
  Database,
} from 'lucide-react';
import { AIQueryResponse } from '../types';
import { translateLabel } from '../lib/i18n';
import { MarkdownRenderer } from './MarkdownRenderer';
import { GoogleEducationMark } from './GoogleSkillsLogo';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  advisorRole?: string;
  toolCalls?: string[];
  metricsContext?: Record<string, unknown>;
  recommendations?: {
    title: string;
    type: string;
    url?: string;
    reason: string;
  }[];
  timestamp: string;
}

interface IntelligenceModuleProps {
  geminiModel: string;
}

const DEFAULT_ADVISOR_ROLE =
  'Asesor Principal de Gestión del Conocimiento & Talento Cloud';

const SAMPLE_PROMPTS = [
  '¿Quiénes son los 5 mayores referentes técnicos de la organización y qué rol les asignarías?',
  '¿Qué candidatos están listos hoy para presentar una certificación oficial de Google Cloud?',
  '¿Dónde están nuestras mayores brechas de conocimiento por equipo y cómo cerrarlas rápido?',
  'Dame un diagnóstico ejecutivo ultra conciso del aprovechamiento de las licencias contratadas.',
  '¿Qué ruta inmediata recomiendas para potenciar IA Generativa y Datos en los equipos TI?',
];

export const IntelligenceModule: React.FC<IntelligenceModuleProps> = ({ geminiModel }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      advisorRole: DEFAULT_ADVISOR_ROLE,
      content: `> **Bienvenido a Google Skills for Organizations v1.1.** Soy tu *${DEFAULT_ADVISOR_ROLE}*, impulsado por **${geminiModel}**.\n\nAnalizo en tiempo real las **actividades históricas**, *dominios técnicos*, **candidatos a certificación** y el retorno de las **licencias de la organización** para entregarte diagnósticos ejecutivos, concisos y accionables.\n\n### 🎯 ¿Qué deseas evaluar hoy?\n- **Perfiles y Roles Técnicos:** Identificación de *Champions*, especialistas y líderes por dominio.\n- **Certificaciones y Brechas:** Quién está listo para examen oficial y qué competencias reforzar.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const historyPayload = messages
      .slice(1)
      .slice(-6)
      .map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('model' as const),
        parts: [{ text: m.content }],
      }));

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend, history: historyPayload }),
      });

      const data: AIQueryResponse & { ok: boolean; error?: string } = await res.json();

      if (data.ok) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.answer,
          advisorRole: data.advisorRole || DEFAULT_ADVISOR_ROLE,
          toolCalls: data.toolCallsExecuted,
          metricsContext: data.metricsContext,
          recommendations: data.recommendations,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            advisorRole: DEFAULT_ADVISOR_ROLE,
            content: `> **Aviso:** ${data.error || 'No se pudo procesar la consulta en este momento.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          advisorRole: DEFAULT_ADVISOR_ROLE,
          content: `> **Error de conexión:** No fue posible contactar al motor Gemini (${err.message}).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Executive Advisor Persona Header Card */}
      <div className="google-card p-6 bg-gradient-to-r from-[#E8F0FE]/75 via-white to-[#F3E8FD]/75 border border-[#D2E3FC] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative overflow-hidden">
        <div className="google-rainbow-bar absolute top-0 left-0 right-0 h-1" />
        <div className="flex items-start space-x-4 pt-1">
          <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center shadow-sm shrink-0 border border-[#DADCE0]">
            <GoogleEducationMark className="w-9 h-9" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#174EA6] border border-[#AECBFA]">
                Rol Activo: Consultor Ejecutivo L&D
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F3E8FD] text-[#7627BB] border border-[#D7AEFB] flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3 text-[#9334E6]" />
                {geminiModel}
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-[#202124]">
              {DEFAULT_ADVISOR_ROLE}
            </h2>
            <p className="text-xs text-[#5F6368] mt-1 max-w-2xl leading-relaxed">
              Especialista en diagnóstico de competencias técnicas, evaluación de madurez Cloud/IA y estrategia de certificación oficial sobre los datos reales de tu organización. Respuestas ejecutivas, estructuradas y accionables.
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1 text-[11px] text-[#174EA6] bg-white border border-[#D2E3FC] px-2.5 py-0.5 rounded-full font-medium">
                <Briefcase className="w-3 h-3 text-[#4285F4]" />
                Asignación de Perfiles Técnicos
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#137333] bg-white border border-[#CEEAD6] px-2.5 py-0.5 rounded-full font-medium">
                <ShieldCheck className="w-3 h-3 text-[#34A853]" />
                Dictamen de Certificaciones
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#B06000] bg-white border border-[#FEEFC3] px-2.5 py-0.5 rounded-full font-medium">
                <Database className="w-3 h-3 text-[#FBBC04]" />
                Auditoría de Licencias y Brechas
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() =>
            setMessages([
              {
                role: 'assistant',
                advisorRole: DEFAULT_ADVISOR_ROLE,
                content: `> **Sesión reiniciada.** Estoy listo como tu *${DEFAULT_ADVISOR_ROLE}*. ¿Qué equipo, indicador o perfil deseas auditar?`,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              },
            ])
          }
          className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#F8FAFD] border border-[#DADCE0] text-xs font-medium text-[#3C4043] transition-colors self-start lg:self-center shrink-0 shadow-2xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#1A73E8]" />
          <span>Nueva Consulta</span>
        </button>
      </div>

      {/* Suggested Executive Prompts */}
      <div className="space-y-2">
        <div className="flex items-center space-x-1.5 text-xs text-[#5F6368] font-medium">
          <Lightbulb className="w-3.5 h-3.5 text-[#FBBC04]" />
          <span>Consultas estratégicas frecuentes al Asesor:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
              className="text-left text-xs px-3.5 py-1.5 rounded-full bg-white border border-[#DADCE0] hover:border-[#AECBFA] hover:bg-[#E8F0FE]/60 text-[#3C4043] hover:text-[#174EA6] shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Workspace */}
      <div className="google-card p-5 sm:p-6 min-h-[500px] flex flex-col justify-between">
        <div className="space-y-5 overflow-y-auto max-h-[620px] pr-2">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3.5 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="h-9 w-9 rounded-2xl bg-white border border-[#DADCE0] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <GoogleEducationMark className="w-6 h-6" />
                </div>
              )}

              <div
                className={`max-w-3xl rounded-2xl p-4 sm:p-5 text-xs sm:text-[13px] shadow-xs ${
                  msg.role === 'user'
                    ? 'bg-[#1A73E8] text-white rounded-tr-none'
                    : 'bg-[#F8FAFD] border border-[#E8EAED] text-[#202124] rounded-tl-none space-y-3'
                }`}
              >
                {/* Advisor Role Header inside Assistant Bubble */}
                {msg.role === 'assistant' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E8EAED]">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#1967D2]">
                        {msg.advisorRole || DEFAULT_ADVISOR_ROLE}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F3E8FD] text-[#7627BB] border border-[#D7AEFB] font-mono">
                        {geminiModel}
                      </span>
                    </div>

                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        {msg.toolCalls.map((t, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]"
                          >
                            ✓ {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Formatted Content */}
                {msg.role === 'user' ? (
                  <div className="font-medium leading-relaxed">{msg.content}</div>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}

                {/* Recommended Catalog Modules */}
                {msg.recommendations && msg.recommendations.length > 0 && (
                  <div className="pt-3 border-t border-[#E8EAED] space-y-2">
                    <span className="text-[11px] font-bold text-[#B06000] flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#E37400]" />
                      Rutas y Módulos del Catálogo Sugeridos por el Asesor:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1">
                      {msg.recommendations.map((rec, rIdx) => (
                        <div
                          key={rIdx}
                          className="p-3 rounded-xl bg-white border border-[#E8EAED] hover:border-[#AECBFA] transition-colors flex flex-col justify-between shadow-2xs"
                        >
                          <div>
                            <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2]">
                              {translateLabel(rec.type)}
                            </span>
                            <h5 className="font-semibold text-[#202124] text-xs mt-1.5 line-clamp-2 leading-snug">
                              {rec.title}
                            </h5>
                            <p className="text-[10px] text-[#5F6368] mt-1 line-clamp-2">
                              {rec.reason}
                            </p>
                          </div>
                          {rec.url && (
                            <a
                              href={rec.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-[#1A73E8] hover:text-[#1557B0] font-semibold mt-2.5"
                            >
                              Abrir en Google Skills
                              <ArrowUpRight className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className={`text-[10px] text-right font-mono pt-1 ${
                    msg.role === 'user' ? 'text-[#D2E3FC]' : 'text-[#5F6368]'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="h-9 w-9 rounded-full bg-[#1A73E8] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start space-x-3.5 justify-start">
              <div className="h-9 w-9 rounded-2xl bg-white border border-[#DADCE0] flex items-center justify-center shrink-0 shadow-2xs">
                <Award className="w-4 h-4 text-[#1A73E8] animate-pulse" />
              </div>
              <div className="bg-[#F8FAFD] border border-[#E8EAED] rounded-2xl rounded-tl-none px-4 py-3 text-xs text-[#3C4043] flex items-center space-x-2.5">
                <div className="w-2 h-2 rounded-full bg-[#1A73E8] animate-ping" />
                <span>
                  El <strong>Asesor de Gestión del Conocimiento</strong> ({geminiModel}) está sintetizando un diagnóstico ejecutivo...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Google Gemini Pill Input Box */}
        <div className="mt-6 pt-4 border-t border-[#E8EAED]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2.5"
          >
            <input
              type="text"
              placeholder="Consulta al Asesor Especializado sobre talento, certificaciones, brechas o ROI..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-[#F8FAFD] border border-[#DADCE0] rounded-full px-5 py-3 text-xs sm:text-sm text-[#202124] placeholder-[#5F6368] focus:bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE] transition-all"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              className="px-5 py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-xs sm:text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Consultar Asesor</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
