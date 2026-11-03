import React, { useState } from 'react';
import {
  Building2,
  Users,
  Info,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Wheat,
  Briefcase,
} from 'lucide-react';
import type { OrgMember } from '../types/agro.ts';
import type { Organization, OrganizationType } from '../types/organization.ts';
import { dataService } from '../services/dataService.ts';

interface OrgOnboardingModalProps {
  activeMember: OrgMember;
  onOrganizationSelected: (org: Organization) => void;
  onSignOut: () => void;
}

export const OrgOnboardingModal: React.FC<OrgOnboardingModalProps> = ({
  activeMember,
  onOrganizationSelected,
  onSignOut,
}) => {
  const [selectedPath, setSelectedPath] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [showCreateInfo, setShowCreateInfo] = useState(false);
  const [showJoinInfo, setShowJoinInfo] = useState(false);

  // Create Form State
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrganizationType>('AGRO_FARMING');
  const [targetContribution, setTargetContribution] = useState('1000');
  const [pace, setPace] = useState<'MONTHLY' | 'MILESTONE' | 'FLEXIBLE'>('MONTHLY');

  // Join Form State
  const [inviteCode, setInviteCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setErrorMsg('Please enter an organization name.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const newOrg = dataService.createOrganization({
        name: orgName.trim(),
        type: orgType,
        actor: activeMember,
        defaultTargetContributionUsd: Number(targetContribution) || 1000,
        contributionPaceDefault: pace,
      });
      onOrganizationSelected(newOrg);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create organization.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setErrorMsg('Please enter the invitation code from your organisation.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const org = await dataService.joinOrganizationWithCode({
        inviteCode: inviteCode.trim().toUpperCase(),
        actor: activeMember,
      });
      onOrganizationSelected(org);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to join organization.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-lg bg-white border border-[#E8DFCE] rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-950 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center space-y-1.5 pb-2 border-b border-[#F0EBE1]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black">
            <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
            <span>CapitaSeed Workspace Onboarding</span>
          </div>
          <h2 className="text-xl font-black text-slate-950">
            Welcome, {activeMember.fullName}
          </h2>
          <p className="text-xs text-slate-600 font-medium">
            To begin using CapitaSeed, create a new workspace or join an existing organization.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-950 flex items-start gap-2.5 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Choice Toggle Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Create Option Card */}
          <div
            onClick={() => setSelectedPath('CREATE')}
            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${selectedPath === 'CREATE'
              ? 'bg-emerald-50 border-emerald-500 shadow-sm'
              : 'bg-[#FAF8F5] border-[#E8DFCE] hover:border-slate-300'
              }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
                <Building2 className="w-5 h-5 text-emerald-700" />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCreateInfo(!showCreateInfo);
                }}
                title="What is this?"
                className="p-1 rounded-full text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xs font-black text-slate-950">Create New Org</h3>
              <p className="text-[10px] text-slate-600 font-medium">Start as Founder Admin</p>
            </div>
          </div>

          {/* Join Option Card */}
          <div
            onClick={() => setSelectedPath('JOIN')}
            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${selectedPath === 'JOIN'
              ? 'bg-amber-50 border-amber-500 shadow-sm'
              : 'bg-[#FAF8F5] border-[#E8DFCE] hover:border-slate-300'
              }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
                <Users className="w-5 h-5 text-amber-700" />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowJoinInfo(!showJoinInfo);
                }}
                title="What is this?"
                className="p-1 rounded-full text-slate-400 hover:text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xs font-black text-slate-950">Join Existing Org</h3>
              <p className="text-[10px] text-slate-600 font-medium">Use code from existing organisation</p>
            </div>
          </div>
        </div>

        {/* Educational Info Popover for Create */}
        {showCreateInfo && (
          <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-xs text-emerald-950 space-y-1 animate-in fade-in">
            <p className="font-black flex items-center gap-1.5 text-emerald-900">
              <Info className="w-3.5 h-3.5 text-emerald-700" />
              <span>When to choose &quot;Create New Organization&quot;:</span>
            </p>
            <p className="text-[11px] text-emerald-900/90 leading-relaxed font-medium">
              Choose this option if you want to start a new company, agricultural farm, or joint investment group as the primary administrator. You will name the organization, choose whether it operates as an Agro-Farming enterprise or a General Business Venture, configure capital contribution goals, and receive an invitation code to invite your partners.
            </p>
          </div>
        )}

        {/* Educational Info Popover for Join */}
        {showJoinInfo && (
          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-xs text-amber-950 space-y-1 animate-in fade-in">
            <p className="font-black flex items-center gap-1.5 text-amber-900">
              <Info className="w-3.5 h-3.5 text-amber-700" />
              <span>When to choose &quot;Join Existing Organization&quot;:</span>
            </p>
            <p className="text-[11px] text-amber-900/90 leading-relaxed font-medium">
              Choose this option if your team owner, farm manager, or business partner has already registered an organization and provided you with an invitation code (e.g. <code>SEED-XXXX</code>). Entering the code grants you instant access as an approved member without waiting for manual verification.
            </p>
          </div>
        )}

        {/* Form A: Create New Organization */}
        {selectedPath === 'CREATE' ? (
          <form onSubmit={handleCreateSubmit} className="space-y-3.5 pt-1">
            <div>
              <label className="block text-xs font-black text-slate-950 mb-1">
                Organization or Farm Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Green Valley Poultry or Harare Synergy Fund"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-950 mb-1">
                Workspace Type &amp; Purpose
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrgType('AGRO_FARMING')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${orgType === 'AGRO_FARMING'
                    ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-black'
                    : 'bg-[#FAF8F5] border-[#E8DFCE] text-slate-700 hover:border-slate-300'
                    }`}
                >
                  <Wheat className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-xs">Agro-Farming</span>
                    <span className="block text-[10px] text-slate-500 font-medium truncate">
                      Livestock &amp; Sites
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOrgType('GENERAL_VENTURE')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${orgType === 'GENERAL_VENTURE'
                    ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-black'
                    : 'bg-[#FAF8F5] border-[#E8DFCE] text-slate-700 hover:border-slate-300'
                    }`}
                >
                  <Briefcase className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-xs">General Venture</span>
                    <span className="block text-[10px] text-slate-500 font-medium truncate">
                      Pool &amp; Deductions
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-black text-slate-950 mb-1">
                  Target Capital Per Member ($)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={targetContribution}
                  onChange={(e) => setTargetContribution(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-950 mb-1">
                  Agreed Pace
                </label>
                <select
                  value={pace}
                  onChange={(e) => setPace(e.target.value as any)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-2 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="MILESTONE">Milestone-Based</option>
                  <option value="FLEXIBLE">Flexible / Self-Paced</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-emerald-700/20 cursor-pointer"
            >
              <span>{loading ? 'Setting Up Workspace...' : 'Create Organization & Enter'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Form B: Join Existing Organization */
          <form onSubmit={handleJoinSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-black text-slate-950 mb-1">
                Invitation Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SEED-8492"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-sm text-slate-950 font-mono font-black tracking-wider uppercase focus:outline-none focus:border-amber-500 focus:bg-white text-center"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-amber-600/20 cursor-pointer"
            >
              <span>{loading ? 'Validating Code...' : 'Join Organization Instantly'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between">
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs text-slate-500 hover:text-rose-600 font-bold transition-colors cursor-pointer"
          >
            Sign Out of Account
          </button>
        </div>
      </div>
    </div>
  );
};

