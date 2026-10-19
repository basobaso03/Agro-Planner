import React, { useState } from 'react';
import {
  ShieldAlert,
  Clock,
  Lock,
  KeyRound,
  UserCheck,
  LogOut,
  CheckCircle2,
  Save,
  Eye,
  EyeOff,
  MessageCircle,
} from 'lucide-react';
import type { SyndicateMember } from '../types/agro.ts';
import { dataService } from '../services/dataService.ts';
import { LogoSvg } from './BrandLogos.tsx';
import { DEVELOPER_INFO } from './DeveloperBrandInfo.tsx';

interface PendingApprovalLobbyProps {
  member: SyndicateMember;
  onSignOut: () => void;
}

export const PendingApprovalLobby: React.FC<PendingApprovalLobbyProps> = ({
  member,
  onSignOut,
}) => {
  const isSuspended = member.approvalStatus === 'SUSPENDED';

  // WhatsApp pre-filled notification to Admin
  const whatsappMsg = encodeURIComponent(
    `Hello Admin, I have registered on Agro Planner.\n\nName: ${member.fullName}\nEmail: ${member.email || member.phoneOrEmail}\nPhone: ${member.phone || 'N/A'}\n\nPlease approve my account so I can access the farm platform.`
  );
  const whatsappUrl = `https://wa.me/${DEVELOPER_INFO.whatsappIntl}?text=${whatsappMsg}`;

  // Profile Edit State while awaiting approval
  const [fullName, setFullName] = useState(member.fullName);
  const [phone, setPhone] = useState(member.phone || member.phoneOrEmail || '');
  const [jobTitle, setJobTitle] = useState(member.jobTitle || '');
  const [bio, setBio] = useState(member.bio || '');
  const [preferredContact, setPreferredContact] = useState<'EMAIL' | 'WHATSAPP' | 'SMS'>(
    member.preferredContact || 'EMAIL'
  );
  const [profileSaved, setProfileSaved] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password Setup State for Google Sign-In users
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwdMessage, setPwdMessage] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSaved('');
    try {
      dataService.updateOwnMemberProfile({
        memberId: member.id,
        fullName,
        phone,
        jobTitle,
        bio,
        preferredContact,
      });
      setProfileSaved('Your profile details have been updated for the farm manager review.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not update profile.');
    }
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdMessage('');
    if (newPassword.length < 8) {
      setPwdError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Passwords do not match.');
      return;
    }
    setPwdLoading(true);
    try {
      await dataService.setupOrUpdatePasswordForCurrentUser({
        member,
        newPassword,
      });
      setNewPassword('');
      setConfirmPassword('');
      setPwdMessage(
        'Password successfully linked to your account. You can now sign in using either Google or Email & Password.'
      );
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Failed to set up password.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between px-4 pt-safe pb-8 sm:px-6 lg:px-12 relative z-10">
      {/* Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4 pt-3 pb-4 border-b border-[#E8DFCE]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#E0D7C6] flex items-center justify-center">
            <LogoSvg size={34} />
          </div>
          <span className="text-base font-bold text-slate-900">Agro Planner</span>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#E0D7C6] text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-5xl mx-auto my-auto py-8 space-y-6">
        {/* Status Banner */}
        <section className="bg-white border border-[#E8DFCE] rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                {isSuspended ? (
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-600" />
                )}
                <span>
                  {isSuspended
                    ? 'Account Temporarily Paused'
                    : 'Account Pending Admin Approval'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {isSuspended
                  ? 'Your Account Has Been Paused'
                  : `Welcome, ${member.fullName}! Your registration has been received.`}
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {isSuspended
                  ? 'Your access has been temporarily paused by the farm administrator. Please reach out to your administrator to resume access.'
                  : 'Your account has been registered successfully. For farm privacy and record security, the farm administrator will review your account and assign your role shortly. This screen will automatically open once approved.'}
              </p>

              {/* Direct Quick WhatsApp Notification to Admin */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Notify Admin on WhatsApp</span>
                </a>
                <span className="text-xs text-slate-500">
                  Tap to quickly notify the manager to approve your account.
                </span>
              </div>
            </div>

            {/* Account Identity Summary */}
            <div className="bg-[#FAF8F5] border border-[#E8DFCE] rounded-2xl p-4 space-y-2 shrink-0 min-w-[260px]">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Registered Account Details</span>
              </div>
              <div className="text-xs text-slate-600 space-y-1 font-mono tabular-nums">
                <div>Name: {member.fullName}</div>
                <div>Email: {member.email || member.phoneOrEmail}</div>
                <div>
                  Sign-In: {(member.authProviders || ['google.com']).join(' · ')}
                </div>
                <div>
                  Status:{' '}
                  <strong className={isSuspended ? 'text-rose-700' : 'text-amber-700'}>
                    {isSuspended ? 'PAUSED' : 'AWAITING APPROVAL'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Two-Column Self-Service Setup While Waiting (Edit Details + Google-to-Password Setup) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Complete Your Member Details */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-[#E8DFCE] rounded-3xl p-6 space-y-4 shadow-xs"
          >
            <div>
              <h2 className="text-base font-bold text-slate-900">
                1. Complete Your Syndicate Profile Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify your contact information and position note so the Admin can assign you to the right role and farm site.
              </p>
            </div>

            {profileSaved && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{profileSaved}</span>
              </p>
            )}
            {profileError && (
              <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                {profileError}
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone / WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+263 77 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferred Contact Channel
                  </label>
                  <select
                    value={preferredContact}
                    onChange={(e) =>
                      setPreferredContact(e.target.value as 'EMAIL' | 'WHATSAPP' | 'SMS')
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500"
                  >
                    <option value="EMAIL">Email</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SMS">SMS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Position / Requested Role Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Investor / Norton Ground Operator / Treasurer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bio / Note for Syndicate Admin
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details about your farm site responsibilities or capital stake..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Profile Details
            </button>
          </form>

          {/* Card 2: Password Setup for Google Sign-In Users */}
          <form
            onSubmit={handleSetupPassword}
            className="bg-white border border-[#E8DFCE] rounded-3xl p-6 space-y-4 shadow-xs flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    <span>
                      {member.hasPasswordSetup
                        ? '2. Update Your Account Password'
                        : '2. Set Up a Password for Your Google Account'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {member.hasPasswordSetup
                      ? 'Your account supports both Google OAuth and Email & Password login.'
                      : 'Signed in with Google? Set up a password now so you can also sign in directly with your email and password.'}
                  </p>
                </div>
              </div>

              {pwdMessage && (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pwdMessage}</span>
                </p>
              )}
              {pwdError && (
                <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                  {pwdError}
                </p>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Linked Email Identifier
                  </label>
                  <input
                    type="email"
                    disabled
                    value={member.email || member.phoneOrEmail}
                    className="w-full bg-slate-100 border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs font-mono text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {member.hasPasswordSetup ? 'New Password *' : 'Create Password (min 8 chars) *'}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-10 pr-10 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-10 pr-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={pwdLoading}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer self-start disabled:opacity-60"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                {pwdLoading
                  ? 'Linking Credential...'
                  : member.hasPasswordSetup
                  ? 'Update Account Password'
                  : 'Link Password to Google Account'}
              </span>
            </button>
          </form>
        </div>
      </main>

      <footer className="w-full max-w-5xl mx-auto pt-4 border-t border-[#E8DFCE] flex items-center justify-between text-xs text-slate-500">
        <span>Agro Planner · Account Verification</span>
        <span>This page unlocks automatically once approved by the farm administrator</span>
      </footer>
    </div>
  );
};
