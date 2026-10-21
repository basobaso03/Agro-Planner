import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  Clock,
  Ban,
  Search,
  Trash2,
  AlertTriangle,
  KeyRound,
  X,
} from 'lucide-react';
import type {
  FarmLocation,
  MemberApprovalStatus,
  Role,
  SyndicateMember,
} from '../types/agro.ts';
import { dataService, PRIMARY_ADMIN_EMAIL } from '../services/dataService.ts';
import { PERMISSIONS, getRoleMeta } from '../utils/permissions.ts';

interface UserManagementTabProps {
  members: SyndicateMember[];
  locations: FarmLocation[];
  activeMember: SyndicateMember;
  showNumbers?: boolean;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({
  members,
  locations,
  activeMember,
  showNumbers = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role | 'PENDING'>('ALL');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Pending User Approval Draft State (memberId -> { role, siteId })
  const [pendingDrafts, setPendingDrafts] = useState<
    Record<string, { role: Role; assignedLocationId: string }>
  >({});

  // Pre-Invite / Add Member Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('REMOTE_INVESTOR');
  const [inviteSiteId, setInviteSiteId] = useState<string>('ALL');
  const [inviteContribution, setInviteContribution] = useState('');

  // Wipe Demo Data / Reset Ledger Confirmation Modal
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeLoading, setWipeLoading] = useState(false);

  // Permanent Member Deletion Modal State
  const [memberToDelete, setMemberToDelete] = useState<SyndicateMember | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isPrimaryFounder =
    (activeMember.email || activeMember.phoneOrEmail || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
  const canManage = PERMISSIONS.canManageMembers(activeMember.role);

  if (!canManage) {
    return (
      <div className="bg-white border border-[#E8DFCE] rounded-3xl p-8 text-center space-y-2">
        <h2 className="text-lg font-bold text-slate-900">
          Access Restricted
        </h2>
        <p className="text-xs text-slate-500">
          Only an administrator can access the User Management &amp; Role Governance Console.
        </p>
      </div>
    );
  }

  const pendingMembers = members.filter(
    (m) => m.approvalStatus === 'PENDING_APPROVAL' || (!m.approvalStatus && !m.active)
  );
  const activeOperatorsCount = members.filter(
    (m) => m.role === 'GROUND_OPERATOR' && m.active
  ).length;
  const privilegedSignersCount = members.filter(
    (m) => (m.role === 'SYNDICATE_ADMIN' || m.role === 'TREASURER') && m.active
  ).length;

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.fullName.toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      m.phoneOrEmail.toLowerCase().includes(q) ||
      (m.jobTitle || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (roleFilter === 'ALL') return true;
    if (roleFilter === 'PENDING') {
      return m.approvalStatus === 'PENDING_APPROVAL' || (!m.approvalStatus && !m.active);
    }
    return m.role === roleFilter;
  });

  const handleRoleOrSiteChange = (
    target: SyndicateMember,
    newRole: Role,
    newStatus: MemberApprovalStatus,
    newSiteId?: string,
    note?: string
  ) => {
    setErrorMsg('');
    setStatusMessage('');
    try {
      const updated = dataService.adminUpdateMemberRoleAndAccess({
        targetMemberId: target.id,
        role: newRole,
        approvalStatus: newStatus,
        assignedLocationId: newSiteId === 'ALL' ? undefined : newSiteId,
        note,
        actor: activeMember,
      });
      setStatusMessage(
        `Updated ${updated.fullName}: Role set to ${getRoleMeta(updated.role).label} (${updated.approvalStatus}). Logged to SHA-256 audit chain.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update member access.');
    }
  };

  const handlePreInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMessage('');
    try {
      const cap = inviteContribution ? Number(inviteContribution) : 0;
      const created = dataService.addMember({
        fullName: inviteName,
        phoneOrEmail: inviteEmail,
        role: inviteRole,
        assignedLocationId: inviteSiteId === 'ALL' ? undefined : inviteSiteId,
        initialContributionUsd: cap > 0 ? cap : undefined,
        contributionNote: cap > 0 ? `Initial capital deposit upon Admin pre-authorization` : undefined,
        actor: activeMember,
      });
      setInviteName('');
      setInviteEmail('');
      setInviteContribution('');
      setShowInviteModal(false);
      setStatusMessage(
        `Pre-authorized ${created.fullName} (${created.phoneOrEmail}) as ${getRoleMeta(created.role).label}. When they sign in, their role is automatically active.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not pre-authorize member.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);
    setErrorMsg('');
    setStatusMessage('');
    try {
      await dataService.deleteMember({
        targetMemberId: memberToDelete.id,
        actor: activeMember,
        reason: deleteReason || 'Account permanently deleted by Primary Founder Admin',
      });
      setStatusMessage(
        `Member ${memberToDelete.fullName} (${memberToDelete.email || memberToDelete.phoneOrEmail}) was permanently deleted from local cache and Cloud.`
      );
      setMemberToDelete(null);
      setDeleteReason('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not delete member.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmWipe = async (mode: 'DEMO_ONLY' | 'FULL_RESET') => {
    setWipeLoading(true);
    setErrorMsg('');
    setStatusMessage('');
    try {
      await dataService.wipeAllDemoAndLedgerData(activeMember, mode);
      setShowWipeModal(false);
      setStatusMessage(
        mode === 'FULL_RESET'
          ? 'All demo and prior ledger records have been purged. Clean Production Ledger initialized at Sequence #1.'
          : 'All legacy demo seed records have been removed.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to purge data.');
    } finally {
      setWipeLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Top Governance Header & Actions */}
      <section className="bg-white border border-[#E8DFCE] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Farm Identity &amp; Role-Based Access Governance</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            User Management &amp; Role Assignment Console
          </h1>
          <p className="text-xs text-slate-500">
            Approve new registrants, switch user roles across the system, assign ground operators to farm sites, and maintain a clean production ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isPrimaryFounder && (
            <button
              type="button"
              onClick={() => setShowWipeModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] hover:bg-rose-50 border border-[#E0D7C6] hover:border-rose-300 text-xs font-bold text-slate-700 hover:text-rose-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Wipe Demo Data / Reset Ledger
            </button>
          )}

          {isPrimaryFounder ? (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              + Pre-Authorize Member
            </button>
          ) : (
            <div className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold flex items-center gap-1.5 select-none">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span>Directory View</span>
            </div>
          )}
        </div>
      </section>

      {!isPrimaryFounder && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Primary Founder Governance:</strong> Member creation, role changes, clearance approvals, suspensions, and account deletions are strictly restricted to the Primary Founder ({PRIMARY_ADMIN_EMAIL}).
          </span>
        </div>
      )}

      {statusMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage('')}
            className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-rose-700 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4-Column KPI Summary Strip (Tabular Numerals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4">
          <span className="text-xs font-medium text-slate-500">Registered Accounts</span>
          <div className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
            {!showNumbers ? '••' : members.length}
          </div>
          <span className="text-[11px] text-slate-500">UID-bound identities</span>
        </div>

        <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4">
          <span className="text-xs font-medium text-slate-500">Pending Clearance</span>
          <div className="text-2xl font-black font-mono tabular-nums text-amber-700 mt-1">
            {!showNumbers ? '••' : pendingMembers.length}
          </div>
          <span className="text-[11px] text-slate-500">Awaiting Admin role assignment</span>
        </div>

        <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4">
          <span className="text-xs font-medium text-slate-500">Privileged Signers</span>
          <div className="text-2xl font-black font-mono tabular-nums text-emerald-700 mt-1">
            {!showNumbers ? '••' : privilegedSignersCount}
          </div>
          <span className="text-[11px] text-slate-500">Admins &amp; Multi-Sig Treasurers</span>
        </div>

        <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4">
          <span className="text-xs font-medium text-slate-500">Ground Operators</span>
          <div className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
            {!showNumbers ? '••' : activeOperatorsCount}
          </div>
          <span className="text-[11px] text-slate-500">Field station operators</span>
        </div>
      </div>

      {/* Pending Approvals Queue (Shown prominently when users are waiting in the lobby) */}
      {pendingMembers.length > 0 && (
        <section className="bg-white border border-amber-300 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#F0EBE1]">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Pending Security Clearance Queue ({!showNumbers ? '••' : pendingMembers.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign an initial system role and farm site to grant these newly registered accounts access to the syndicate portal.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {pendingMembers.map((pending) => {
              const draft = pendingDrafts[pending.id] || {
                role: pending.role || 'REMOTE_INVESTOR',
                assignedLocationId: pending.assignedLocationId || 'ALL',
              };

              return (
                <div
                  key={pending.id}
                  className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {pending.fullName}
                      </span>
                      <span className="text-xs font-mono text-slate-600">
                        · {pending.email || pending.phoneOrEmail}
                      </span>
                      {pending.phone && (
                        <span className="text-xs font-mono text-slate-500">
                          · {pending.phone}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Registered {new Date(pending.joinedAt).toLocaleDateString()} · Methods:{' '}
                      <span className="font-mono">
                        {(pending.authProviders || ['google.com']).join(', ')}
                      </span>
                      {pending.jobTitle && ` · Note: "${pending.jobTitle}"`}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <select
                      aria-label={`Select role for ${pending.fullName}`}
                      value={draft.role}
                      onChange={(e) =>
                        setPendingDrafts({
                          ...pendingDrafts,
                          [pending.id]: {
                            ...draft,
                            role: e.target.value as Role,
                          },
                        })
                      }
                      className="bg-white border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                    >
                      <option value="REMOTE_INVESTOR">Remote Investor</option>
                      <option value="GROUND_OPERATOR">Ground Operator</option>
                      <option value="TREASURER">Syndicate Treasurer</option>
                      <option value="SYNDICATE_ADMIN">Syndicate Admin</option>
                    </select>

                    <select
                      aria-label={`Select site for ${pending.fullName}`}
                      value={draft.assignedLocationId}
                      onChange={(e) =>
                        setPendingDrafts({
                          ...pendingDrafts,
                          [pending.id]: {
                            ...draft,
                            assignedLocationId: e.target.value,
                          },
                        })
                      }
                      className="bg-white border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                    >
                      <option value="ALL">All Farm Sites</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        handleRoleOrSiteChange(
                          pending,
                          draft.role,
                          'APPROVED',
                          draft.assignedLocationId,
                          'Initial registration approved by Syndicate Admin'
                        )
                      }
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve &amp; Grant Access
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleRoleOrSiteChange(
                          pending,
                          draft.role,
                          'SUSPENDED',
                          draft.assignedLocationId,
                          'Registration suspended by Admin'
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border border-[#E0D7C6] text-xs font-semibold text-rose-700 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Member Role & Site Assignment Matrix */}
      <section className="bg-white border border-[#E8DFCE] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0EBE1]">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              <span>Syndicate User Directory &amp; Role Switcher</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Easily switch any member between Syndicate Admin, Treasurer, Remote Investor, or Ground Operator roles, or update their farm site assignment in real time.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <select
              aria-label="Filter members by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
              className="bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Roles ({members.length})</option>
              <option value="PENDING">Pending Approval ({pendingMembers.length})</option>
              <option value="SYNDICATE_ADMIN">Syndicate Admins</option>
              <option value="TREASURER">Treasurers</option>
              <option value="REMOTE_INVESTOR">Remote Investors</option>
              <option value="GROUND_OPERATOR">Ground Operators</option>
            </select>
          </div>
        </div>

        {/* High-Density SaaS Member Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8DFCE] text-[11px] font-bold text-slate-500">
                <th className="py-2.5 pr-4">Member Identity &amp; Contact</th>
                <th className="py-2.5 px-3">Auth Methods</th>
                <th className="py-2.5 px-3">Assigned System Role</th>
                <th className="py-2.5 px-3">Assigned Farm Site</th>
                <th className="py-2.5 px-3">Clearance Status</th>
                <th className="py-2.5 pl-3 text-right">Governance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE1] text-xs">
              {filteredMembers.map((mem) => {
                const isFounder =
                  (mem.email || mem.phoneOrEmail).toLowerCase() === PRIMARY_ADMIN_EMAIL;
                const currentStatus: MemberApprovalStatus =
                  mem.approvalStatus || (mem.active ? 'APPROVED' : 'PENDING_APPROVAL');
                const providers = mem.authProviders || ['google.com'];

                return (
                  <tr key={mem.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    <td className="py-3.5 pr-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{mem.fullName}</span>
                        {mem.id === activeMember.id && (
                          <span className="text-[10px] font-mono text-amber-700">(You)</span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {mem.email || mem.phoneOrEmail}
                        {mem.phone && mem.email ? ` · ${mem.phone}` : ''}
                      </div>
                      {mem.jobTitle && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{mem.jobTitle}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {providers.includes('google.com') &&
                          (providers.includes('password') || mem.hasPasswordSetup)
                            ? 'Google + Password'
                            : providers.includes('password') || mem.hasPasswordSetup
                            ? 'Email & Password'
                            : 'Google OAuth'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <select
                        aria-label={`Change role for ${mem.fullName}`}
                        disabled={isFounder || !isPrimaryFounder}
                        value={mem.role}
                        onChange={(e) =>
                          handleRoleOrSiteChange(
                            mem,
                            e.target.value as Role,
                            currentStatus,
                            mem.assignedLocationId || 'ALL',
                            `Role switched from ${getRoleMeta(mem.role).label} to ${getRoleMeta(e.target.value as Role).label}`
                          )
                        }
                        className="bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 disabled:opacity-70 cursor-pointer"
                      >
                        <option value="SYNDICATE_ADMIN">Syndicate Admin</option>
                        <option value="TREASURER">Syndicate Treasurer</option>
                        <option value="REMOTE_INVESTOR">Remote Investor</option>
                        <option value="GROUND_OPERATOR">Ground Operator</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-3">
                      <select
                        aria-label={`Assign site for ${mem.fullName}`}
                        disabled={!isPrimaryFounder}
                        value={mem.assignedLocationId || 'ALL'}
                        onChange={(e) =>
                          handleRoleOrSiteChange(
                            mem,
                            mem.role,
                            currentStatus,
                            e.target.value,
                            `Site assignment updated`
                          )
                        }
                        className="bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 disabled:opacity-70 cursor-pointer"
                      >
                        <option value="ALL">All Sites (Master)</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-[11px]">
                      {currentStatus === 'APPROVED' ? (
                        <span className="text-emerald-700 font-bold">APPROVED · ACTIVE</span>
                      ) : currentStatus === 'PENDING_APPROVAL' ? (
                        <span className="text-amber-700 font-bold">PENDING CLEARANCE</span>
                      ) : (
                        <span className="text-rose-700 font-bold">SUSPENDED</span>
                      )}
                    </td>

                    <td className="py-3.5 pl-3 text-right whitespace-nowrap">
                      {isFounder ? (
                        <span className="text-[11px] font-mono text-slate-400">
                          Primary Founder
                        </span>
                      ) : !isPrimaryFounder ? (
                        <span className="text-[11px] font-mono text-slate-400">
                          View Only
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {currentStatus === 'APPROVED' ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleRoleOrSiteChange(
                                  mem,
                                  mem.role,
                                  'SUSPENDED',
                                  mem.assignedLocationId || 'ALL',
                                  'Account suspended by Primary Founder'
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-[#E0D7C6] text-xs font-semibold text-rose-700 inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Suspend</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleRoleOrSiteChange(
                                  mem,
                                  mem.role,
                                  'APPROVED',
                                  mem.assignedLocationId || 'ALL',
                                  'Account approved & activated by Primary Founder'
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setMemberToDelete(mem);
                              setDeleteReason('');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title={`Permanently delete ${mem.fullName}`}
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal 1: Pre-Authorize / Invite New Member */}
      {showInviteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay-responsive"
        >
          <div className="modal-dialog-responsive max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <h2 className="text-base font-bold text-slate-900">
                Pre-Authorize Syndicate Member
              </h2>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePreInviteSubmit} className="modal-body-scroll mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Farai Moyo"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address or Phone *
                </label>
                <input
                  type="text"
                  required
                  placeholder="farai@domain.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Role *
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    <option value="REMOTE_INVESTOR">Remote Investor</option>
                    <option value="GROUND_OPERATOR">Ground Operator</option>
                    <option value="TREASURER">Treasurer</option>
                    <option value="SYNDICATE_ADMIN">Syndicate Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Farm Site
                  </label>
                  <select
                    value={inviteSiteId}
                    onChange={(e) => setInviteSiteId(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
                  >
                    <option value="ALL">All Sites</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional Initial Capital Contribution (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={inviteContribution}
                  onChange={(e) => setInviteContribution(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold"
                >
                  Pre-Authorize Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWipeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay-responsive"
        >
          <div className="modal-dialog-responsive max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Wipe Demo Data &amp; Reset Ledger</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowWipeModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body-scroll mt-4 space-y-3">

            <p className="text-xs text-slate-600 leading-relaxed">
              Choose whether to purge only residual demo seed records or perform a full production reset (clearing all farm sites, expenses, livestock, and capital entries while keeping your verified Admin account).
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={wipeLoading}
                onClick={() => handleConfirmWipe('DEMO_ONLY')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-xs font-bold text-slate-800 cursor-pointer"
              >
                Purge Legacy Seed Records Only
              </button>

              <button
                type="button"
                disabled={wipeLoading}
                onClick={() => handleConfirmWipe('FULL_RESET')}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                {wipeLoading ? 'Purging Ledger...' : 'Full Reset: Start Fresh Production Ledger'}
              </button>

              <button
                type="button"
                onClick={() => setShowWipeModal(false)}
                className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Modal 3: Confirm Permanent Member Deletion */}
      {memberToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay-responsive"
        >
          <div className="modal-dialog-responsive max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-rose-200 shrink-0">
              <h2 className="text-base font-bold text-rose-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Permanently Delete Member</span>
              </h2>
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body-scroll mt-4 space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-rose-950">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Permanent Irreversible Action</span>
                </div>
                <p>
                  You are about to permanently delete <strong>{memberToDelete.fullName}</strong> ({memberToDelete.email || memberToDelete.phoneOrEmail}) from local storage and the Google Firestore Cloud database.
                </p>
                {memberToDelete.role === 'SYNDICATE_ADMIN' && (
                  <p className="font-semibold text-rose-700">
                    Notice: This account has <strong>Syndicate Admin</strong> privileges. Deleting will permanently revoke all administrative access.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Deletion (Logged to SHA-256 Audit Chain)
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Member left syndicate / Contract ended"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E0D7C6] bg-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Deleting from Cloud & Ledger...' : 'Confirm Permanent Deletion'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
