import React, { useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { copyToClipboard } from '../../native/clipboard.ts';
import { shareContent } from '../../native/share.ts';
import { dataService } from '../../services/dataService.ts';
import { PERMISSIONS } from '../../utils/permissions.ts';
import type { OrgMember } from '../../types/agro.ts';

export interface InviteCodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
}

export const InviteCodeSheet: React.FC<InviteCodeSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
}) => {
  const { showToast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const orgId = activeMember.orgId || dataService.getState().activeOrgId || 'org-master';
  const org = (dataService.getState().organizations || []).find((o) => o.id === orgId);

  const inviteCode = org?.currentInviteCode || 'SEED-8492';
  const expiresAt = org?.inviteCodeExpiresAt ? new Date(org.inviteCodeExpiresAt) : null;
  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false;

  const canRefresh = PERMISSIONS.canRefreshInviteCode(activeMember.role);

  const handleCopy = async () => {
    const success = await copyToClipboard(inviteCode);
    if (success) {
      showToast({
        type: 'success',
        title: 'Invite Code Copied',
        message: `Code ${inviteCode} copied to clipboard.`,
      });
    }
  };

  const handleShare = async () => {
    const orgName = org?.name || 'OmniVentures';
    const message = `Join our organization "${orgName}" on Capitaseed / OmniVentures!\n\nEnter 24-hr Invite Code: ${inviteCode}\n(Valid for 24 hours).`;
    await shareContent({
      title: `Invite Code for ${orgName}`,
      text: message,
      dialogTitle: 'Share Invite Code',
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      dataService.refreshInviteCode({
        orgId,
        actor: activeMember,
      });
      showToast({
        type: 'success',
        title: 'New Code Generated',
        message: 'Prior code invalidated. New 24-hour code is active.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Refresh Failed',
        message: err?.message || 'Could not generate new code.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Organization Invite Code" maxHeight="80dvh">
      <div className="space-y-5">
        <div className="text-center py-2">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">
            Active 24-Hour Access Code
          </div>
          <div className="inline-block px-6 py-3.5 bg-[#FAF8F5] rounded-2xl border-2 border-emerald-600/30">
            <span className="font-mono text-3xl font-extrabold tracking-widest text-emerald-700">
              {inviteCode}
            </span>
          </div>
          <div className="mt-2 text-xs font-semibold text-slate-600">
            {isExpired ? (
              <span className="text-rose-600 font-bold">⚠️ Code has expired. Refresh required.</span>
            ) : expiresAt ? (
              <span>Expires at {expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            ) : (
              <span>Valid for 24 hours</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-white border border-[#E8DFCE] text-slate-950 shadow-xs hover:bg-stone-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            📋 Copy Code
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            📲 Share Code
          </button>
        </div>

        {canRefresh && (
          <div className="pt-3 border-t border-[#E8DFCE]">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full py-2.5 px-3 rounded-xl border border-[#E8DFCE] text-xs font-bold text-slate-950 hover:bg-stone-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              🔄 {isRefreshing ? 'Generating...' : 'Regenerate Code (Admin)'}
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-1.5 font-medium">
              Regenerating will immediately invalidate any previous codes sent to prospective members.
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

