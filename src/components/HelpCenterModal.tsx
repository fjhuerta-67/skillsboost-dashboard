import React, { useEffect, useState } from 'react';
import { X, BookOpen, Download, Search, FileText, Terminal, Database, ShieldCheck } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ManualDocument {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  filename: string;
  content: string;
}

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({ isOpen, onClose }) => {
  const [manuals, setManuals] = useState<ManualDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string>('user-guide');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/manuals')
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && Array.isArray(res.manuals)) {
          setManuals(res.manuals);
          if (res.manuals.length > 0 && !res.manuals.some((m: ManualDocument) => m.id === selectedId)) {
            setSelectedId(res.manuals[0].id);
          }
        }
      })
      .catch((err) => console.error('Error cargando manuales:', err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const activeDoc = manuals.find((m) => m.id === selectedId) || manuals[0] || null;

  const filteredContent = (() => {
    if (!activeDoc) return '';
    const q = searchTerm.trim().toLowerCase();
    if (!q) return activeDoc.content;
    const sections = activeDoc.content.split(/\n(?=##\s+)/);
    const matched = sections.filter((s) => s.toLowerCase().includes(q));
    return matched.length > 0
      ? matched.join('\n\n---\n\n')
      : `> No se encontraron secciones con **"${searchTerm}"** en este manual. Prueba seleccionando otro documento en la columna izquierda.`;
  })();

  const handleDownload = (doc: ManualDocument) => {
    const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getIcon = (id: string) => {
    switch (id) {
      case 'user-guide':
        return BookOpen;
      case 'admin-cloud':
        return ShieldCheck;
      case 'bigquery-bi':
        return Database;
      case 'terraform-iac':
        return Terminal;
      default:
        return FileText;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#202124]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white border border-[#DADCE0] rounded-3xl w-full max-w-6xl h-[88vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="google-rainbow-bar h-1.5 w-full" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8EAED] bg-[#F8FAFD] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#202124]">
                Centro de Documentación y Manuales Oficiales
              </h3>
              <p className="text-xs text-[#5F6368]">
                Guías de uso ejecutivo, operación en Cloud Run, diccionario BigQuery y despliegue con Terraform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5F6368] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar tema en manual..."
                className="pl-8 pr-3 py-1.5 rounded-full bg-white border border-[#DADCE0] text-xs text-[#202124] placeholder-[#9AA0A6] focus:outline-none focus:border-[#1A73E8] w-48 sm:w-60"
              />
            </div>

            {activeDoc && (
              <button
                onClick={() => handleDownload(activeDoc)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F1F3F4] text-[#1A73E8] border border-[#D2E3FC] text-xs font-semibold transition-colors cursor-pointer"
                title="Descargar manual en formato Markdown (.md)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Descargar .md</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#5F6368] hover:text-[#202124] hover:bg-[#E8EAED] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-[#E8EAED] bg-[#F8FAFD] p-3 overflow-y-auto shrink-0 space-y-1.5">
            {manuals.map((doc) => {
              const Icon = getIcon(doc.id);
              const active = activeDoc?.id === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedId(doc.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                    active
                      ? 'bg-white border-[#AECBFA] shadow-xs'
                      : 'bg-transparent border-transparent hover:bg-white/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        active
                          ? 'bg-[#E8F0FE] text-[#174EA6]'
                          : 'bg-[#E8EAED] text-[#5F6368]'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {doc.badge}
                    </span>
                  </div>
                  <div
                    className={`text-xs font-bold leading-snug ${
                      active ? 'text-[#1A73E8]' : 'text-[#202124]'
                    }`}
                  >
                    {doc.title}
                  </div>
                  <div className="text-[11px] text-[#5F6368] mt-0.5 line-clamp-2 leading-relaxed">
                    {doc.subtitle}
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Content Viewer */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white">
            {loading ? (
              <div className="text-xs text-[#5F6368] py-12 text-center">
                Cargando biblioteca de manuales...
              </div>
            ) : activeDoc ? (
              <div className="max-w-4xl mx-auto text-xs sm:text-[13px]">
                <MarkdownRenderer content={filteredContent} />
              </div>
            ) : (
              <div className="text-xs text-[#5F6368] py-12 text-center">
                No se encontraron documentos de ayuda disponibles.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
