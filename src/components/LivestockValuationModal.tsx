import React, { useState } from 'react';
import {
  X,
  TrendingUp,
  DollarSign,
  Bird,
  Scale,
  Edit2,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { LivestockComputedStatus, OrgMember } from '../types/agro.ts';
import { dataService } from '../services/dataService.ts';

interface LivestockValuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  livestockStatuses: LivestockComputedStatus[];
  activeMember: OrgMember;
  showNumbers?: boolean;
}

export const LivestockValuationModal: React.FC<LivestockValuationModalProps> = ({
  isOpen,
  onClose,
  livestockStatuses,
  activeMember,
  showNumbers = true,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPriceUnit, setEditPriceUnit] = useState<string>('');
  const [editPriceKg, setEditPriceKg] = useState<string>('');
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalLiveAnimals = livestockStatuses.reduce((acc, s) => acc + s.currentLiveHeadcount, 0);
  const totalExpectedRevenue = livestockStatuses.reduce(
    (acc, s) => acc + (s.totalExpectedRevenueUsd || s.estimatedCurrentValueUsd),
    0
  );
  const totalProjectedMargin = livestockStatuses.reduce(
    (acc, s) => acc + (s.totalProjectedMarginUsd || 0),
    0
  );

  const handleStartEdit = (status: LivestockComputedStatus) => {
    setEditingId(status.entry.id);
    setEditPriceUnit(String(status.configuredSalePricePerUnit || 6.0));
    setEditPriceKg(status.configuredSalePricePerKg ? String(status.configuredSalePricePerKg) : '');
  };

  const handleSavePrice = (status: LivestockComputedStatus) => {
    const pUnit = parseFloat(editPriceUnit);
    const pKg = parseFloat(editPriceKg);

    const updatedEntry = {
      ...status.entry,
      configuredSalePricePerUnit: !isNaN(pUnit) && pUnit > 0 ? pUnit : status.configuredSalePricePerUnit,
      configuredSalePricePerKg: !isNaN(pKg) && pKg > 0 ? pKg : undefined,
    };

    // Update via dataService
    dataService.configureLivestockValuationPrice({
      livestockId: status.entry.id,
      configuredSalePricePerUnit: !isNaN(pUnit) && pUnit > 0 ? pUnit : (status.configuredSalePricePerUnit || 0),
      configuredSalePricePerKg: !isNaN(pKg) && pKg > 0 ? pKg : undefined,
      actor: activeMember,
    });

    setEditingId(null);
    setSaveSuccessId(status.entry.id);
    setTimeout(() => setSaveSuccessId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white border border-[#E8DFCE] shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#F0EBE1] bg-gradient-to-r from-amber-500/10 via-amber-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Livestock Valuation &amp; Expected Income
              </h2>
              <p className="text-xs text-slate-500">
                Configure unit selling prices to calculate live projected revenue per animal and entire herd
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Valuation Summary Cards */}
        <div className="grid grid-cols-3 gap-3 p-4 sm:p-6 bg-[#FAF8F5] border-b border-[#E8DFCE]">
          <div className="bg-white p-3 rounded-2xl border border-[#E8DFCE] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Live Animals
            </span>
            <div className="text-lg sm:text-2xl font-black font-mono text-slate-900 mt-0.5">
              {!showNumbers ? '••••' : totalLiveAnimals.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Across all sites</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-[#E8DFCE] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
              Expected Total Income
            </span>
            <div className="text-lg sm:text-2xl font-black font-mono text-amber-600 mt-0.5">
              {!showNumbers ? '••••••' : `$${totalExpectedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">At configured market prices</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-[#E8DFCE] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              Projected Net Margin
            </span>
            <div className="text-lg sm:text-2xl font-black font-mono text-emerald-600 mt-0.5">
              {!showNumbers ? '••••••' : `$${totalProjectedMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">After chick &amp; feed costs</span>
          </div>
        </div>

        {/* Batch Valuation List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {livestockStatuses.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-[#FAF8F5] border border-dashed border-[#E8DFCE]">
              <Bird className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">No Active Livestock Batches</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Add your broilers, layers, or goats in the Livestock tab to configure selling prices and project expected income.
              </p>
            </div>
          ) : (
            livestockStatuses.map((st) => {
              const isEditing = editingId === st.entry.id;
              const unitPrice = st.configuredSalePricePerUnit || 6.0;
              const expectedBatchRevenue = st.totalExpectedRevenueUsd || st.currentLiveHeadcount * unitPrice;
              const perAnimalRevenue = st.expectedRevenuePerAnimalUsd || unitPrice;

              return (
                <div
                  key={st.entry.id}
                  className="p-4 rounded-2xl bg-white border border-[#E8DFCE] shadow-xs hover:border-amber-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{st.entry.nameOrTag}</span>
                        <span className="text-[10px] font-mono uppercase bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                          {st.entry.species}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          ({st.currentLiveHeadcount} Live)
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>Location: <strong>{st.entry.locationName}</strong></span>
                        <span>•</span>
                        <span>Age: <strong>Day {st.currentTotalAgeDays}</strong></span>
                        {st.latestWeightAvgKg && (
                          <>
                            <span>•</span>
                            <span>Avg Weight: <strong>{st.latestWeightAvgKg} kg</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2 bg-amber-50 p-2 rounded-xl border border-amber-200">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-amber-800 block">Price / Animal ($)</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={editPriceUnit}
                              onChange={(e) => setEditPriceUnit(e.target.value)}
                              className="w-20 px-2 py-1 text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg text-slate-900"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-amber-800 block">Price / Kg ($)</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              placeholder="Opt"
                              value={editPriceKg}
                              onChange={(e) => setEditPriceKg(e.target.value)}
                              className="w-16 px-2 py-1 text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg text-slate-900"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSavePrice(st)}
                            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
                            title="Save configured price"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                              Unit Configured Price
                            </span>
                            <span className="text-sm font-black font-mono text-slate-800">
                              ${unitPrice.toFixed(2)} / animal
                            </span>
                            {st.configuredSalePricePerKg && (
                              <span className="text-[10px] text-slate-500 block">
                                (${st.configuredSalePricePerKg.toFixed(2)}/kg)
                              </span>
                            )}
                          </div>

                          <div className="border-l border-slate-200 pl-3">
                            <span className="text-[10px] text-amber-700 uppercase tracking-wider font-bold block">
                              Batch Expected Income
                            </span>
                            <span className="text-base font-black font-mono text-amber-600">
                              ${expectedBatchRevenue.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-semibold block">
                              Margin: +${(st.totalProjectedMarginUsd || 0).toFixed(2)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(st)}
                            className="p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer transition-colors"
                            title="Configure selling price"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {saveSuccessId === st.entry.id && (
                    <div className="mt-2 text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Configured selling price updated successfully!
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
