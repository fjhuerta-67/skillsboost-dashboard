import React, { useState } from 'react';
import { CatalogItem } from '../types';
import { translateLabel } from '../lib/i18n';
import { BookOpen, Search, Filter, ExternalLink, Clock, Layers } from 'lucide-react';

interface CatalogViewProps {
  catalog: CatalogItem[];
  isLoading: boolean;
}

const CARD_TOP_COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'];

export const CatalogView: React.FC<CatalogViewProps> = ({ catalog, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedType, setSelectedType] = useState<string>('Todos');

  const categories = ['Todas', ...Array.from(new Set(catalog.map((c) => c.category)))];
  const types = ['Todos', ...Array.from(new Set(catalog.map((c) => c.content_type)))];

  const filteredCatalog = catalog.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'Todas' || item.category === selectedCategory;
    const matchesType = selectedType === 'Todos' || item.content_type === selectedType;
    return matchesSearch && matchesCat && matchesType;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header and Filter Controls */}
      <div className="google-card p-6 space-y-4 border-l-4 border-l-[#34A853]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#202124] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#34A853]" />
              Catálogo de Aprendizaje de Google Skills
            </h2>
            <p className="text-xs text-[#5F6368] mt-1">
              Plantillas de cursos sincronizados, laboratorios prácticos y rutas de aprendizaje publicadas ({catalog.length} elementos disponibles)
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4285F4]" />
            <input
              type="text"
              placeholder="Buscar en el catálogo por título, habilidad o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#F8FAFD] border border-[#DADCE0] rounded-full pl-10 pr-4 py-2 text-xs text-[#202124] placeholder-[#5F6368] focus:bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-[#E8EAED]">
          <div className="flex items-center space-x-2 text-xs text-[#5F6368] font-medium">
            <Filter className="w-3.5 h-3.5 text-[#1A73E8]" />
            <span>Categoría:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs transition-colors border cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#1A73E8] text-white border-[#1A73E8] font-semibold'
                    : 'bg-[#F8FAFD] text-[#3C4043] border-[#DADCE0] hover:bg-[#E8F0FE] hover:text-[#174EA6]'
                }`}
              >
                {translateLabel(cat)}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 text-xs text-[#5F6368] font-medium ml-auto">
            <span>Tipo:</span>
            <div className="flex flex-wrap gap-1.5">
              {types.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors border cursor-pointer ${
                    selectedType === type
                      ? 'bg-[#1E8E3E] text-white border-[#1E8E3E] font-semibold'
                      : 'bg-[#F8FAFD] text-[#3C4043] border-[#DADCE0] hover:bg-[#E6F4EA] hover:text-[#137333]'
                  }`}
                >
                  {translateLabel(type)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Cards Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 border-3 border-[#E8F0FE] border-t-[#1A73E8] rounded-full animate-spin" />
          <p className="text-xs text-[#5F6368] font-medium">
            Cargando catálogo desde la API de Google Skills...
          </p>
        </div>
      ) : filteredCatalog.length === 0 ? (
        <div className="google-card p-12 text-center text-[#5F6368] text-sm">
          Ningún curso o laboratorio coincide con los filtros seleccionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCatalog.map((item, idx) => (
            <div
              key={item.content_id}
              className="google-card p-5 flex flex-col justify-between group relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: CARD_TOP_COLORS[idx % CARD_TOP_COLORS.length] }}
              />
              <div className="pt-1">
                {/* Badges Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC]">
                    {translateLabel(item.content_type)}
                  </span>
                  {item.level && (
                    <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-[#F1F3F4] text-[#5F6368] border border-[#E8EAED]">
                      {translateLabel(item.level)}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-[#202124] group-hover:text-[#1A73E8] transition-colors line-clamp-2">
                  {item.name}
                </h3>
                <p className="text-xs text-[#5F6368] mt-2 line-clamp-3 leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Meta details & action */}
              <div className="mt-5 pt-3 border-t border-[#E8EAED] space-y-3">
                <div className="flex items-center justify-between text-[11px] text-[#5F6368]">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#5F6368]" />
                    <span>{item.duration ? `${item.duration} min` : 'A propio ritmo'}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#1A73E8]" />
                    <span className="font-medium text-[#3C4043]">
                      {translateLabel(item.category)}
                    </span>
                  </div>
                </div>

                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-full bg-[#E8F0FE] hover:bg-[#1A73E8] hover:text-white text-[#1967D2] text-xs font-semibold transition-colors"
                  >
                    <span>Abrir en Google Skills</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
