import React from 'react';
import { SyncStatus } from '../types';
import { RefreshCw, Sparkles, Database, AlertCircle, Settings, Cloud, BookOpen } from 'lucide-react';
import { GoogleSkillsLogo } from './GoogleSkillsLogo';

interface HeaderProps {
  syncStatus: SyncStatus | null;
  onSync: (forceDemo?: boolean) => void;
  onOpenSettings: () => void;
  onOpenManuals: () => void;
  isSyncing: boolean;
  geminiModel: string;
  runtimeInfo?: {
    env: 'local' | 'cloud';
    storageBackend: 'local' | 'gcs' | 'bigquery';
    gcsBucket?: string | null;
    bqDataset?: string | null;
    geminiAuthMode?: 'api_key' | 'vertex_ai' | 'unconfigured';
    lockSettings?: boolean;
  };
}

export const Header: React.FC<HeaderProps> = ({
  syncStatus,
  onSync,
  onOpenSettings,
  onOpenManuals,
  isSyncing,
  geminiModel,
  runtimeInfo,
}) => {
  return (
    <header className="border-b border-[#DADCE0] bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-2xs">
      <div className="google-rainbow-bar h-1.5 w-full" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Branding & Title: Google Logo + Custom Education Emblem + Google Skills for Organizations v1.0 */}
        <GoogleSkillsLogo showSubtitle />

        {/* Status Indicators & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Cloud Run / BigQuery / GCS Runtime Badge if running in Cloud */}
          {runtimeInfo?.env === 'cloud' && (
            <div
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#E8F0FE] border border-[#D2E3FC] text-[#174EA6] text-xs"
              title={
                runtimeInfo.bqDataset
                  ? `Data Warehouse activo: ${runtimeInfo.bqDataset}`
                  : runtimeInfo.gcsBucket
                  ? `Almacenamiento GCS: gs://${runtimeInfo.gcsBucket}`
                  : 'Ejecutando en Google Cloud Run'
              }
            >
              <Cloud className="w-3.5 h-3.5 text-[#1A73E8]" />
              <span className="font-semibold">
                {runtimeInfo.storageBackend === 'bigquery' ? 'Cloud Run • BigQuery' : 'Cloud Run'}
              </span>
            </div>
          )}

          {/* Gemini Badge */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#E8F0FE] via-[#F3E8FD] to-[#FEF7E0] border border-[#D2E3FC] text-[#174EA6] text-xs shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#9334E6]" />
            <span className="font-semibold text-[#202124]">
              {runtimeInfo?.geminiAuthMode === 'vertex_ai' ? 'Vertex AI Gemini' : 'Google Gemini'}
            </span>
            <span className="text-[#5F6368] font-mono text-[10px]">({geminiModel})</span>
          </div>

          {/* Sync Mode Badge */}
          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs ${
              syncStatus?.mode === 'live'
                ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]'
                : 'bg-[#FEF7E0] border-[#FEEFC3] text-[#B06000]'
            }`}
          >
            <Database
              className={`w-3.5 h-3.5 ${
                syncStatus?.mode === 'live' ? 'text-[#1E8E3E]' : 'text-[#F9AB00]'
              }`}
            />
            <span className="text-[#5F6368]">Modo:</span>
            <span className="font-semibold capitalize">
              {syncStatus?.mode === 'live' ? 'API en Vivo' : 'Datos Demo'}
            </span>
          </div>

          {/* Interactive Manuals / Help Center Button */}
          <button
            onClick={onOpenManuals}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white hover:bg-[#F8F9FA] text-[#3C4043] border border-[#DADCE0] hover:border-[#BDC1C6] transition-all shadow-2xs cursor-pointer"
            title="Abrir Centro de Manuales (Uso, Cloud Run, BigQuery y Terraform)"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#1A73E8]" />
            <span>Manuales</span>
          </button>

          {/* API Settings Button */}
          {!runtimeInfo?.lockSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white hover:bg-[#F8F9FA] text-[#3C4043] border border-[#DADCE0] hover:border-[#BDC1C6] transition-all shadow-2xs cursor-pointer"
              title="Configurar Claves API y Slug de Organización"
            >
              <Settings className="w-3.5 h-3.5 text-[#5F6368]" />
              <span>Claves API</span>
            </button>
          )}

          {/* Sync / Refresh Button */}
          <button
            onClick={() => onSync(false)}
            disabled={isSyncing || syncStatus?.status === 'syncing'}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-medium text-white transition-all shadow-sm cursor-pointer ${
              isSyncing || syncStatus?.status === 'syncing'
                ? 'bg-[#8AB4F8] cursor-not-allowed'
                : 'bg-[#1A73E8] hover:bg-[#1557B0] active:scale-95 shadow-[#1A73E8]/20'
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isSyncing || syncStatus?.status === 'syncing' ? 'animate-spin' : ''
              }`}
            />
            <span>
              {isSyncing || syncStatus?.status === 'syncing' ? 'Sincronizando...' : 'Sincronizar'}
            </span>
          </button>
        </div>
      </div>

      {/* Live Sync Progress / Error Strip */}
      {(isSyncing || syncStatus?.status === 'syncing') && (
        <div className="bg-[#E8F0FE] border-t border-[#D2E3FC] px-4 py-2 text-xs text-[#174EA6]">
          <div className="max-w-7xl mx-auto flex items-center space-x-2.5">
            <RefreshCw className="w-3.5 h-3.5 text-[#1A73E8] animate-spin shrink-0" />
            <span className="font-medium">
              {syncStatus?.message || 'Sincronizando historial completo con Google Skills API v2...'}
            </span>
          </div>
        </div>
      )}

      {!isSyncing && syncStatus?.status === 'error' && syncStatus.message && (
        <div className="bg-[#FCE8E6] border-t border-[#FAD2CF] px-4 py-2 text-xs text-[#C5221F]">
          <div className="max-w-7xl mx-auto flex items-center space-x-2.5">
            <AlertCircle className="w-3.5 h-3.5 text-[#EA4335] shrink-0" />
            <span className="font-medium">{syncStatus.message}</span>
          </div>
        </div>
      )}
    </header>
  );
};
