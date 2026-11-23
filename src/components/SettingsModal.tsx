import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle2, AlertCircle, RefreshCw, Save, Lock } from 'lucide-react';
import { ApiConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ApiConfig, triggerSync: boolean) => Promise<void>;
  onResetDemo: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onResetDemo,
}) => {
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [hasSecretKey, setHasSecretKey] = useState(false);
  const [lockedInCloud, setLockedInCloud] = useState(false);
  const [orgInput, setOrgInput] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://www.skills.google/api/v2');
  const [contractedLicenses, setContractedLicenses] = useState<number>(500);

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    authenticated?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      fetch('/api/settings')
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.config) {
            setAccessKey(data.config.accessKey || '');
            setSecretKey(data.config.secretKey || '');
            setHasSecretKey(Boolean(data.config.hasSecretKey));
            setLockedInCloud(Boolean(data.config.lockedInCloud));
            setOrgInput(data.config.organizationSlug || '');
            setBaseUrl(data.config.baseUrl || 'https://www.skills.google/api/v2');
            setContractedLicenses(Number(data.config.contractedLicenses) || 500);
          }
        })
        .catch((err) => console.error('Failed to load settings:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const extractSlug = (input: string) => {
    const match = input.match(/organization\/([^/]+)/);
    if (match) return match[1];
    return input.trim().replace(/^\/+|\/+$/g, '');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: accessKey.trim(),
          secretKey: secretKey.trim(),
          organizationSlug: extractSlug(orgInput),
          baseUrl: baseUrl.trim(),
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        ok: false,
        error: `Error en la prueba de conexión: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async (triggerSync: boolean) => {
    setIsSaving(true);
    try {
      const cleanSlug = extractSlug(orgInput);
      await onSave(
        {
          accessKey: accessKey.trim(),
          secretKey: secretKey.trim(),
          organizationSlug: cleanSlug,
          baseUrl: baseUrl.trim(),
          contractedLicenses: Number(contractedLicenses) || 500,
        },
        triggerSync
      );
      onClose();
    } catch (err) {
      console.error('Failed saving settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const canTestOrSave = Boolean(accessKey && (secretKey || hasSecretKey));

  return (
    <div className="fixed inset-0 z-50 bg-[#202124]/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white border border-[#DADCE0] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="google-rainbow-bar h-1.5 w-full" />

        {/* Modal Header */}
        <div className="p-6 border-b border-[#E8EAED] flex items-center justify-between bg-[#F8FAFD]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC]">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#202124]">
                Credenciales y Licencias — Google Skills for Organizations
              </h3>
              <p className="text-xs text-[#5F6368]">
                Configura las claves API de tu organización y el cupo contratado para reportes en vivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#5F6368] hover:text-[#202124] hover:bg-[#E8EAED] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {lockedInCloud && (
            <div className="p-3.5 rounded-xl bg-[#E8F0FE] border border-[#D2E3FC] text-xs text-[#174EA6] flex items-start space-x-2.5">
              <Lock className="w-4 h-4 text-[#1A73E8] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-[#202124]">Modo Google Cloud Protegido:</span> Las claves API están resguardadas en <b>Google Secret Manager</b> y nunca viajan en texto plano al navegador. Puedes ajustar el cupo contractual de licencias aquí mismo.
              </div>
            </div>
          )}

          {/* Access Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#3C4043] flex items-center justify-between">
              <span>Clave de Acceso API (AK_...)</span>
              <span className="text-[10px] text-[#5F6368] font-mono">
                {lockedInCloud ? 'Secret Manager' : 'Requerido'}
              </span>
            </label>
            <input
              type="text"
              placeholder="ej. AK_tu_clave_de_acceso"
              value={accessKey}
              disabled={lockedInCloud}
              onChange={(e) => setAccessKey(e.target.value)}
              className="w-full bg-white border border-[#DADCE0] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#202124] placeholder-[#9AA0A6] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE] disabled:bg-[#F8F9FA] disabled:text-[#5F6368]"
            />
          </div>

          {/* Secret Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#3C4043] flex items-center justify-between">
              <span>Clave Secreta API (SK_...)</span>
              <span className="text-[10px] text-[#5F6368] font-mono">
                {lockedInCloud ? 'Secret Manager (Enmascarada)' : hasSecretKey ? 'Enmascarada por seguridad' : 'Requerido'}
              </span>
            </label>
            <input
              type="password"
              placeholder="ej. SK_tu_clave_secreta"
              value={secretKey}
              disabled={lockedInCloud}
              onFocus={() => {
                if (!lockedInCloud && secretKey.startsWith('••••')) {
                  setSecretKey('');
                }
              }}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full bg-white border border-[#DADCE0] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#202124] placeholder-[#9AA0A6] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE] disabled:bg-[#F8F9FA] disabled:text-[#5F6368]"
            />
          </div>

          {/* Organization Slug or URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#3C4043] flex items-center justify-between">
              <span>Slug de Organización o URL del Portal de Administración</span>
              <span className="text-[10px] text-[#1A73E8] font-medium">Pega la URL completa o el slug</span>
            </label>
            <input
              type="text"
              placeholder="ej. https://www.skills.google/organization/tu-slug/settings"
              value={orgInput}
              disabled={lockedInCloud}
              onChange={(e) => setOrgInput(e.target.value)}
              className="w-full bg-white border border-[#DADCE0] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#202124] placeholder-[#9AA0A6] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE] disabled:bg-[#F8F9FA] disabled:text-[#5F6368]"
            />
            <p className="text-[11px] text-[#5F6368] leading-relaxed">
              Se encuentra en la barra de direcciones del portal de administración:{' '}
              <code className="text-[#1967D2] bg-[#E8F0FE] px-1.5 py-0.5 rounded">
                .../organization/<b>tu-slug</b>/...
              </code>
            </p>
          </div>

          {/* Contracted Licenses Pool */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#3C4043] flex items-center justify-between">
              <span>Cupo de Licencias Contratadas (Contrato Anual)</span>
              <span className="text-[10px] text-[#137333] font-medium">Base para ROI y Adopción</span>
            </label>
            <input
              type="number"
              min={1}
              step={10}
              value={contractedLicenses}
              onChange={(e) => setContractedLicenses(Math.max(1, Number(e.target.value) || 500))}
              className="w-full bg-white border border-[#DADCE0] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#202124] placeholder-[#9AA0A6] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#E8F0FE]"
            />
            <p className="text-[11px] text-[#5F6368] leading-relaxed">
              La API v2 de Google Skills expone invitaciones aceptadas y pendientes vía{' '}
              <code className="text-[#3C4043] bg-[#F1F3F4] px-1.5 py-0.5 rounded">/stats</code>, mientras que el tope contractual de asientos concurrentes (ej. 500) se define aquí para calcular aprovechamiento y simulaciones financieras.
            </p>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
                testResult.ok
                  ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]'
                  : 'bg-[#FCE8E6] border-[#FAD2CF] text-[#C5221F]'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-[#1E8E3E] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#D93025] shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed font-medium">
                {testResult.message || testResult.error}
              </div>
            </div>
          )}

          {/* Connection Test Button */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !canTestOrSave}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#3C4043] border border-[#DADCE0] text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Probando Autenticación...' : 'Probar Conexión'}</span>
            </button>

            {!lockedInCloud && (
              <button
                type="button"
                onClick={async () => {
                  await onResetDemo();
                  onClose();
                }}
                className="text-[11px] text-[#5F6368] hover:text-[#1A73E8] underline cursor-pointer"
              >
                Cambiar a Datos de Demostración
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E8EAED] bg-[#F8FAFD] flex items-center justify-end space-x-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-medium text-[#5F6368] hover:text-[#202124] hover:bg-[#E8EAED] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => handleSaveConfig(false)}
            disabled={isSaving || !canTestOrSave}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#F1F3F4] text-[#3C4043] border border-[#DADCE0] text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar</span>
          </button>
          <button
            onClick={() => handleSaveConfig(true)}
            disabled={isSaving || !canTestOrSave}
            className="flex items-center space-x-1.5 px-5 py-2 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Guardando...' : 'Guardar y Sincronizar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
