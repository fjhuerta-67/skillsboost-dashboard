import React, { useState } from 'react';
import { FinanceBaselineStats } from '../types';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Ticket,
  PiggyBank,
  Sliders,
} from 'lucide-react';

interface FinancialSimulatorProps {
  baseline: FinanceBaselineStats | null;
  isLoading: boolean;
}

export const FinancialSimulator: React.FC<FinancialSimulatorProps> = ({
  baseline,
  isLoading,
}) => {
  const [annualSeatCostUsd, setAnnualSeatCostUsd] = useState<number>(299);
  const [voucherCostUsd, setVoucherCostUsd] = useState<number>(200);
  const [externalHourCostUsd, setExternalHourCostUsd] = useState<number>(120);

  if (isLoading || !baseline) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#E6F4EA] border-t-[#34A853] rounded-full animate-spin" />
        <p className="text-[#5F6368] text-sm font-medium">
          Consolidando modelo financiero de licencias y certificaciones...
        </p>
      </div>
    );
  }

  const totalLicenseInvestment = baseline.totalSeats * annualSeatCostUsd;
  const activeInvestment = baseline.activeSeats * annualSeatCostUsd;
  const unusedCapitalWaste = baseline.unusedSeats * annualSeatCostUsd;

  const costPerEffectiveHour =
    baseline.totalHoursTrained > 0
      ? Math.round((totalLicenseInvestment / baseline.totalHoursTrained) * 10) / 10
      : 0;

  const equivalentExternalTrainingValue = Math.round(
    baseline.totalHoursTrained * externalHourCostUsd
  );
  const netSavingsVsExternal = equivalentExternalTrainingValue - activeInvestment;

  const immediateVoucherBudget = baseline.voucherReadyCandidates * voucherCostUsd;
  const pipelineVoucherBudget =
    (baseline.voucherReadyCandidates + baseline.advancedProgressCandidates) * voucherCostUsd;

  const fmtUsd = (val: number) =>
    `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="google-card p-6 border-l-4 border-l-[#34A853]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#137333] bg-[#E6F4EA] px-2.5 py-0.5 rounded-full">
          Planeación Financiera y Presupuesto L&D
        </span>
        <h2 className="text-xl font-bold text-[#202124] mt-2">
          Simulador Financiero de Licencias, ROI y Presupuesto de Vouchers
        </h2>
        <p className="text-xs text-[#5F6368] mt-1">
          Ajusta los supuestos unitarios para estimar el costo efectivo por hora, el capital subutilizado en asientos inactivos y el presupuesto para certificar al talento listo.
        </p>
      </div>

      {/* Interactive Sliders / Unit Parameters */}
      <div className="google-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#3C4043]">
          <Sliders className="w-4 h-4 text-[#1E8E3E]" />
          <span>Parámetros Financieros Interactivos (USD)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="space-y-2 p-4 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED]">
            <div className="flex justify-between text-xs">
              <span className="text-[#5F6368] font-medium">Costo Anual / Licencia Skills</span>
              <span className="font-mono font-bold text-[#137333]">${annualSeatCostUsd} USD</span>
            </div>
            <input
              type="range"
              min={99}
              max={699}
              step={10}
              value={annualSeatCostUsd}
              onChange={(e) => setAnnualSeatCostUsd(Number(e.target.value))}
              className="w-full accent-[#34A853] cursor-pointer"
            />
          </div>

          <div className="space-y-2 p-4 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED]">
            <div className="flex justify-between text-xs">
              <span className="text-[#5F6368] font-medium">Costo Examen / Voucher GCP</span>
              <span className="font-mono font-bold text-[#E37400]">${voucherCostUsd} USD</span>
            </div>
            <input
              type="range"
              min={99}
              max={350}
              step={5}
              value={voucherCostUsd}
              onChange={(e) => setVoucherCostUsd(Number(e.target.value))}
              className="w-full accent-[#FBBC04] cursor-pointer"
            />
          </div>

          <div className="space-y-2 p-4 rounded-2xl bg-[#F8FAFD] border border-[#E8EAED]">
            <div className="flex justify-between text-xs">
              <span className="text-[#5F6368] font-medium">Costo Hora Instructor Externo</span>
              <span className="font-mono font-bold text-[#1A73E8]">
                ${externalHourCostUsd} USD/hr
              </span>
            </div>
            <input
              type="range"
              min={40}
              max={300}
              step={10}
              value={externalHourCostUsd}
              onChange={(e) => setExternalHourCostUsd(Number(e.target.value))}
              className="w-full accent-[#4285F4] cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#4285F4]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Inversión Contrato Vigente
            </span>
            <div className="p-2 rounded-xl bg-[#E8F0FE] text-[#1A73E8]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#202124] font-mono">
            {fmtUsd(totalLicenseInvestment)}
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Base: {baseline.totalSeats.toLocaleString()} licencias concurrentes (
            {baseline.activeSeats.toLocaleString()} en uso)
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#EA4335]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Capital en Licencias Sin Uso
            </span>
            <div className="p-2 rounded-xl bg-[#FCE8E6] text-[#D93025]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#C5221F] font-mono">
            {fmtUsd(unusedCapitalWaste)}
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Recuperable al activar {baseline.unusedSeats.toLocaleString()} asientos sin uso este año
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#FBBC04]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Presupuesto Vouchers
            </span>
            <div className="p-2 rounded-xl bg-[#FEF7E0] text-[#E37400]">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#E37400] font-mono">
            {fmtUsd(immediateVoucherBudget)}
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            {baseline.voucherReadyCandidates} listos hoy ({fmtUsd(pipelineVoucherBudget)} con pipeline)
          </div>
        </div>

        <div className="google-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#34A853]" />
          <div className="flex items-center justify-between text-[#5F6368] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Valor Equivalente Externo
            </span>
            <div className="p-2 rounded-xl bg-[#E6F4EA] text-[#1E8E3E]">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#137333] font-mono">
            {fmtUsd(equivalentExternalTrainingValue)}
          </div>
          <div className="mt-2 text-xs text-[#5F6368]">
            Costo efectivo: ${costPerEffectiveHour}/hr (
            {netSavingsVsExternal >= 0
              ? `Ahorro ${fmtUsd(netSavingsVsExternal)}`
              : 'En rampa de activación'}
            )
          </div>
        </div>
      </div>

      {/* Team Financial Allocation Breakdown Table */}
      <div className="google-card overflow-hidden">
        <div className="p-6 border-b border-[#E8EAED]">
          <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#1E8E3E]" />
            Auditoría Financiera por Unidad / Centro de Costos
          </h3>
          <p className="text-xs text-[#5F6368] mt-0.5">
            Desglose del presupuesto asignado, presupuesto aprovechado y capital ocioso por cada equipo
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8EAED] bg-[#F8FAFD] text-[10px] font-semibold text-[#5F6368] uppercase tracking-wider">
                <th className="py-3.5 px-6">Unidad / Equipo</th>
                <th className="py-3.5 px-4 text-center">Licencias (Activas/Total)</th>
                <th className="py-3.5 px-4 text-right">Presupuesto Asignado</th>
                <th className="py-3.5 px-4 text-right">Capital Aprovechado</th>
                <th className="py-3.5 px-4 text-right">Capital Sin Uso</th>
                <th className="py-3.5 px-6 text-right">Valor Horas Generadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED] text-xs">
              {baseline.teamSeatBreakdown.map((t) => {
                const assigned = t.totalSeats * annualSeatCostUsd;
                const activeVal = t.activeSeats * annualSeatCostUsd;
                const wasteVal = t.unusedSeats * annualSeatCostUsd;
                const generatedVal = Math.round(t.hoursTrained * externalHourCostUsd);
                return (
                  <tr key={t.team_name} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-[#202124]">{t.team_name}</td>
                    <td className="py-3.5 px-4 text-center font-mono text-[#3C4043]">
                      <span className="text-[#137333] font-bold">{t.activeSeats}</span> /{' '}
                      {t.totalSeats}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#3C4043]">
                      {fmtUsd(assigned)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#137333]">
                      {fmtUsd(activeVal)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#C5221F]">
                      {fmtUsd(wasteVal)}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono font-bold text-[#1A73E8]">
                      {fmtUsd(generatedVal)}{' '}
                      <span className="text-[10px] text-[#5F6368] font-normal">
                        ({t.hoursTrained}h)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
