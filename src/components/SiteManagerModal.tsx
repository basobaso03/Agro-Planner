import React, { useState } from 'react';
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  User,
  Compass,
  Building,
  Navigation,
  Loader2,
} from 'lucide-react';
import type { FarmLocation, OrgMember } from '../types/agro.ts';
import { ConfirmSheet } from './ui/ConfirmSheet.tsx';
import { BottomSheet } from './ui/BottomSheet.tsx';
import { dataService } from '../services/dataService.ts';
import { PERMISSIONS } from '../utils/permissions.ts';

interface SiteManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: FarmLocation[];
  activeMember: OrgMember;
  onSiteSelected?: (siteId: string) => void;
}

export const SiteManagerModal: React.FC<SiteManagerModalProps> = ({
  isOpen,
  onClose,
  locations,
  activeMember,
  onSiteSelected,
}) => {
  const [editingLoc, setEditingLoc] = useState<FarmLocation | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [gps, setGps] = useState('');
  const [operator, setOperator] = useState('');

  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [decommissionTarget, setDecommissionTarget] = useState<FarmLocation | null>(null);

  const handleGetDeviceGps = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser or device.');
      return;
    }
    setIsLocatingGps(true);
    setErrorMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setGps(`${lat}, ${lng}`);
        setIsLocatingGps(false);
      },
      (err) => {
        setIsLocatingGps(false);
        setErrorMsg(`Could not acquire GPS: ${err.message}. Please enter coordinates manually.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  if (!isOpen) return null;

  const canEdit = PERMISSIONS.canEditLocation(activeMember.role);
  const canDelete = PERMISSIONS.canDeleteLocation(activeMember.role);
  const canAdd = PERMISSIONS.canAddLocations(activeMember.role);

  const startCreate = () => {
    setEditingLoc(null);
    setName('');
    setRegion('');
    setGps('-17.8292, 31.0522');
    setOperator(activeMember.fullName);
    setIsCreatingNew(true);
    setStatusMsg('');
    setErrorMsg('');
  };

  const startEdit = (loc: FarmLocation) => {
    setIsCreatingNew(false);
    setEditingLoc(loc);
    setName(loc.name);
    setRegion(loc.region);
    setGps(loc.gpsCoordinates);
    setOperator(loc.primaryOperatorName);
    setStatusMsg('');
    setErrorMsg('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    try {
      if (isCreatingNew) {
        dataService.addLocation({
          name,
          region,
          gpsCoordinates: gps,
          primaryOperatorName: operator,
          actor: activeMember,
        });
        setStatusMsg(`Site "${name}" created successfully.`);
        setIsCreatingNew(false);
      } else if (editingLoc) {
        dataService.updateLocation({
          locationId: editingLoc.id,
          name,
          region,
          gpsCoordinates: gps,
          primaryOperatorName: operator,
          actor: activeMember,
        });
        setStatusMsg(`Site "${name}" updated successfully.`);
        setEditingLoc(null);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Operation failed.');
    }
  };

  const executeDelete = (loc: FarmLocation) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = dataService.deleteLocation({
        locationId: loc.id,
        actor: activeMember,
      });
      setStatusMsg(res.message);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete site.');
    }
  };

  const handleDelete = (loc: FarmLocation) => {
    setDecommissionTarget(loc);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Farm Sites & Station Management"
      subtitle="Manage operational farm locations, stations and ground operators"
    >
      <div className="space-y-4 p-1">
        {statusMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 flex items-start gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Edit / Create Form */}
        {(isCreatingNew || editingLoc) && (
          <form
            onSubmit={handleSave}
            className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E0D7C6] space-y-3 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-950">
                {isCreatingNew ? 'Register New Farm Site' : `Edit Site: ${editingLoc?.name}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingLoc(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-950 font-bold"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-950 mb-1">
                  Site Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Masvingo East Ranch"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-950 mb-1">
                  Region / District <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Masvingo / Mashonaland"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-950 mb-1">
                  Primary Operator Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Farai Moyo"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-black text-slate-950">
                    GPS Coordinates
                  </label>
                  <button
                    type="button"
                    onClick={handleGetDeviceGps}
                    disabled={isLocatingGps}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                    title="Acquire current latitude and longitude using hardware GPS"
                  >
                    {isLocatingGps ? (
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
                    ) : (
                      <Navigation className="w-3 h-3 text-emerald-700" />
                    )}
                    <span>{isLocatingGps ? 'Locating...' : 'Use My Current Device GPS'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="-17.8292, 31.0522"
                  value={gps}
                  onChange={(e) => setGps(e.target.value)}
                  className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-xs transition-colors"
              >
                {isCreatingNew ? 'Create Farm Site' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Existing Sites List */}
        <div className="space-y-2.5 pr-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-950">
              Registered Sites ({locations.length})
            </span>
            {canAdd && !isCreatingNew && (
              <button
                type="button"
                onClick={startCreate}
                className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-800" />
                <span>Add Site</span>
              </button>
            )}
          </div>

          {locations.length === 0 && !isCreatingNew && (
            <div className="p-6 text-center border-2 border-dashed border-[#E8DFCE] rounded-2xl space-y-3 bg-[#FAF8F5]">
              <Building className="w-8 h-8 text-amber-600 mx-auto" />
              <div>
                <h4 className="text-sm font-black text-slate-950">No Farm Sites Registered</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Register your primary farm, kraal, station, or operational branch to begin managing livestock, inventory, and sales.
                </p>
              </div>
              {canAdd && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-md inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>＋ Register First Site</span>
                </button>
              )}
            </div>
          )}

          {locations.map((loc) => (
            <div
              key={loc.id}
              className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-all"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-slate-950 truncate">{loc.name}</h4>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-800">
                    {loc.region}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 font-medium">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Operator: {loc.primaryOperatorName}</span>
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10px]">
                    <Compass className="w-3 h-3 text-slate-400" />
                    <span>{loc.gpsCoordinates}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {onSiteSelected && (
                  <button
                    type="button"
                    onClick={() => {
                      onSiteSelected(loc.id);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E0D7C6] hover:border-emerald-500 text-slate-900 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Select
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => startEdit(loc)}
                    title="Edit site details"
                    className="p-1.5 rounded-lg bg-white border border-[#E0D7C6] hover:bg-slate-100 text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(loc)}
                    title="Delete / Decommission site"
                    className="p-1.5 rounded-lg bg-white border border-[#E0D7C6] hover:bg-rose-50 text-slate-700 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmSheet
        isOpen={Boolean(decommissionTarget)}
        onClose={() => setDecommissionTarget(null)}
        onConfirm={() => decommissionTarget && executeDelete(decommissionTarget)}
        title="Decommission Site"
        message={`Are you sure you want to permanently decommission site "${decommissionTarget?.name}"? This action is audited.`}
        confirmLabel="Decommission"
        isDestructive
      />
    </BottomSheet>
  );
};

