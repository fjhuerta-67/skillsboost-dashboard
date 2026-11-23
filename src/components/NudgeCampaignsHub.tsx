import React, { useState } from 'react';
import {
  CampaignSegmentId,
  NudgeCampaignDraft,
  NudgeSegmentSummary,
} from '../types';
import { translateLabel } from '../lib/i18n';
import {
  Megaphone,
  Mail,
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  Send,
  Users,
  ExternalLink,
} from 'lucide-react';

interface NudgeCampaignsHubProps {
  segments: NudgeSegmentSummary[];
  isLoading: boolean;
  geminiModel: string;
}

const SEGMENT_ACCENTS = [
  { bar: '#EA4335', activeBg: 'bg-[#FCE8E6]/60 border-[#EA4335]', badge: 'text-[#C5221F]' },
  { bar: '#FBBC04', activeBg: 'bg-[#FEF7E0]/70 border-[#FBBC04]', badge: 'text-[#B06000]' },
  { bar: '#34A853', activeBg: 'bg-[#E6F4EA]/70 border-[#34A853]', badge: 'text-[#137333]' },
  { bar: '#4285F4', activeBg: 'bg-[#E8F0FE]/70 border-[#4285F4]', badge: 'text-[#1967D2]' },
];

export const NudgeCampaignsHub: React.FC<NudgeCampaignsHubProps> = ({
  segments,
  isLoading,
  geminiModel,
}) => {
  const [selectedSegmentId, setSelectedSegmentId] = useState<CampaignSegmentId>('inactive_zero');
  const [channel, setChannel] = useState<'email' | 'chat'>('email');
  const [tone, setTone] = useState<'ejecutivo' | 'motivacional' | 'urgente'>('motivacional');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<NudgeCampaignDraft | null>(null);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedEmails, setCopiedEmails] = useState(false);

  const activeSegment = segments.find((s) => s.id === selectedSegmentId) || segments[0];

  const handleGenerateDraft = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/nudge-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentId: selectedSegmentId,
          channel,
          tone,
        }),
      });
      const data = await res.json();
      if (data.ok && data.draft) {
        setDraft(data.draft);
      }
    } catch (err) {
      console.error('Error generando campaña de activación:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyBody = () => {
    if (!draft) return;
    navigator.clipboard.writeText(`Asunto: ${draft.subject}\n\n${draft.messageBody}`);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleCopyEmails = () => {
    if (!activeSegment) return;
    const list = activeSegment.sampleRecipients.map((r) => r.email).join('; ');
    navigator.clipboard.writeText(list);
    setCopiedEmails(true);
    setTimeout(() => setCopiedEmails(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#FCE8E6] border-t-[#EA4335] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Segmentando audiencias de activación y retención...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="google-card p-6 border-l-4 border-l-[#EA4335]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#C5221F] bg-[#FCE8E6] px-2.5 py-0.5 rounded-full">
          Activación Proactiva y Comunicación Interna
        </span>
        <h2 className="text-xl font-bold text-[#202124] mt-2">
          Centro de Campañas de Activación y Recordatorios (Nudge Hub)
        </h2>
        <p className="text-xs text-[#5F6368] mt-1">
          Convierte los hallazgos de inactividad en acción inmediata: selecciona una audiencia y genera comunicados para Gmail o Google Chat con {geminiModel}.
        </p>
      </div>

      {/* Segment Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {segments.map((seg, idx) => {
          const isSelected = seg.id === selectedSegmentId;
          const accent = SEGMENT_ACCENTS[idx % SEGMENT_ACCENTS.length];
          return (
            <button
              key={seg.id}
              onClick={() => setSelectedSegmentId(seg.id)}
              className={`text-left p-5 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden cursor-pointer ${
                isSelected ? `${accent.activeBg} shadow-sm` : 'google-card'
              }`}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: accent.bar }}
              />
              <div className="pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#5F6368]">
                    Segmento
                  </span>
                  <span className="text-xl font-bold text-[#202124] font-mono">{seg.count}</span>
                </div>
                <h3 className="text-sm font-bold text-[#202124] mt-2">{seg.title}</h3>
                <p className="text-[11px] text-[#5F6368] mt-1 leading-snug">{seg.subtitle}</p>
              </div>
              <div className={`mt-4 pt-2 border-t border-[#E8EAED] text-[11px] font-semibold ${accent.badge}`}>
                {isSelected ? '✓ Audiencia seleccionada' : 'Seleccionar audiencia →'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Campaign Studio */}
      {activeSegment && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Audience List & Controls (2 cols) */}
          <div className="lg:col-span-2 google-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#EA4335]" />
                Destinatarios ({activeSegment.count})
              </h3>
              <button
                onClick={handleCopyEmails}
                className="inline-flex items-center gap-1 text-[11px] px-3 py-1 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#3C4043] font-medium cursor-pointer"
              >
                {copiedEmails ? (
                  <Check className="w-3 h-3 text-[#1E8E3E]" />
                ) : (
                  <Copy className="w-3 h-3 text-[#5F6368]" />
                )}
                <span>{copiedEmails ? 'Correos copiados' : 'Copiar correos'}</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {activeSegment.sampleRecipients.length === 0 ? (
                <p className="text-xs text-[#5F6368] py-4 text-center">
                  No hay personas en este segmento actualmente.
                </p>
              ) : (
                activeSegment.sampleRecipients.map((r) => (
                  <div
                    key={r.email}
                    className="p-2.5 rounded-xl bg-[#F8FAFD] border border-[#E8EAED] flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-[#202124] truncate">{r.name}</div>
                      <div className="text-[10px] font-mono text-[#5F6368] truncate">{r.email}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-semibold text-[#C5221F] block">
                        {r.detail}
                      </span>
                      <span className="text-[9px] text-[#5F6368]">
                        {translateLabel(r.team_name)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Channel & Tone */}
            <div className="pt-4 border-t border-[#E8EAED] space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#3C4043] mb-1.5">
                  Canal de Envío
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('email')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      channel === 'email'
                        ? 'bg-[#E8F0FE] text-[#174EA6] border-[#AECBFA] font-semibold'
                        : 'bg-[#F8FAFD] text-[#5F6368] border-[#DADCE0] hover:bg-[#F1F3F4]'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 text-[#EA4335]" />
                    <span>Gmail / Correo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('chat')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      channel === 'chat'
                        ? 'bg-[#E6F4EA] text-[#137333] border-[#A8DAB5] font-semibold'
                        : 'bg-[#F8FAFD] text-[#5F6368] border-[#DADCE0] hover:bg-[#F1F3F4]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#34A853]" />
                    <span>Google Chat</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#3C4043] mb-1.5">
                  Tono del Mensaje
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['motivacional', 'ejecutivo', 'urgente'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className={`py-1.5 rounded-full text-xs capitalize border transition-colors cursor-pointer ${
                        tone === t
                          ? 'bg-[#FCE8E6] text-[#C5221F] border-[#F6AEA9] font-semibold'
                          : 'bg-[#F8FAFD] text-[#5F6368] border-[#DADCE0] hover:bg-[#F1F3F4]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateDraft}
                disabled={generating}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-full bg-gradient-to-r from-[#EA4335] to-[#FBBC04] hover:opacity-95 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60 cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                <span>
                  {generating ? 'Redactando Comunicado con IA...' : 'Redactar Campaña con Gemini IA'}
                </span>
              </button>
            </div>
          </div>

          {/* Generated Message Preview (3 cols) */}
          <div className="lg:col-span-3 google-card p-6 flex flex-col justify-between">
            {generating ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 border-3 border-[#FCE8E6] border-t-[#EA4335] rounded-full animate-spin" />
                <p className="text-xs text-[#3C4043] font-medium">
                  Personalizando mensaje y seleccionando laboratorio recomendado con {geminiModel}...
                </p>
              </div>
            ) : draft ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8EAED] pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-[#1A73E8]">
                      Vista Previa Lista para Enviar ({draft.channel === 'email' ? 'Gmail' : 'Google Chat'})
                    </span>
                    <h4 className="text-base font-bold text-[#202124] mt-0.5">{draft.subject}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyBody}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#202124] text-xs font-medium cursor-pointer"
                    >
                      {copiedBody ? (
                        <Check className="w-3.5 h-3.5 text-[#1E8E3E]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#5F6368]" />
                      )}
                      <span>{copiedBody ? 'Copiado' : 'Copiar Mensaje'}</span>
                    </button>

                    {draft.channel === 'email' && draft.recipientEmails.length > 0 && (
                      <a
                        href={`mailto:?bcc=${encodeURIComponent(
                          draft.recipientEmails.join(',')
                        )}&subject=${encodeURIComponent(
                          draft.subject
                        )}&body=${encodeURIComponent(draft.messageBody)}`}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold shadow-2xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Abrir en Cliente de Correo</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#F8FAFD] border border-[#DADCE0] whitespace-pre-wrap text-xs sm:text-sm text-[#202124] leading-relaxed">
                  {draft.messageBody}
                </div>

                <div className="p-3.5 rounded-xl bg-[#E8F0FE]/60 border border-[#D2E3FC] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-[#5F6368] font-medium block">
                      Módulo sugerido incluido en la campaña:
                    </span>
                    <span className="font-semibold text-[#174EA6]">{draft.recommendedLabName}</span>
                  </div>
                  <a
                    href={draft.recommendedLabUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#1A73E8] hover:text-[#1557B0] font-semibold shrink-0"
                  >
                    Ver módulo
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-[#5F6368] text-xs flex flex-col items-center gap-3">
                <Megaphone className="w-9 h-9 text-[#EA4335]/70" />
                <span>
                  Elige el segmento, canal y tono a la izquierda y haz clic en{' '}
                  <strong>"Redactar Campaña con Gemini IA"</strong>.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
