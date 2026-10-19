import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  Briefcase,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Globe,
  Smartphone,
  Fingerprint,
} from 'lucide-react';
import { dataService } from '../services/dataService.ts';
import { LogoSvg } from './BrandLogos.tsx';
import {
  DEVELOPER_INFO,
  ModernEmailIcon,
  ModernLinkedInIcon,
  ModernWhatsAppIcon,
} from './DeveloperBrandInfo.tsx';
import { getEnrolledBiometricRecord } from '../utils/mobileHardware.ts';

interface AuthGatePageProps {}

export const AuthGatePage: React.FC<AuthGatePageProps> = () => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Compute password strength for registration
  const passwordStrength = React.useMemo(() => {
    if (!password) return { score: 0, label: 'Minimum 8 characters' };
    let s = 0;
    if (password.length >= 8) s += 1;
    if (password.length >= 12) s += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s += 1;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) s += 1;
    const labels = ['Too Short', 'Weak', 'Fair', 'Good', 'Strong Zero-Trust'];
    return { score: s, label: labels[s] || 'Strong' };
  }, [password]);

  const enrolledBiometric = React.useMemo(() => getEnrolledBiometricRecord(), []);

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await dataService.signInWithGoogleCloud();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/unauthorized-domain')) {
        setErrorMsg(
          'Google Web Sign-In is restricted by domain security on mobile networks. Please register or sign in with Email & Password or Fingerprint below (works on any network!).'
        );
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Google Sign-In could not be completed. Please use Email & Password or Fingerprint.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await dataService.signInWithBiometrics();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Biometric authentication could not be verified.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'REGISTER') {
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify your confirmation password.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'LOGIN') {
        await dataService.signInWithEmailAccount({
          email,
          password,
        });
      } else {
        await dataService.registerWithEmailAccount({
          fullName,
          email,
          phone,
          jobTitle,
          password,
        });
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between px-4 pt-safe pb-8 sm:px-6 lg:px-12 relative z-10">
      {/* Top Minimal Brand Header with Link to Public Pages */}
      <header className="w-full max-w-lg mx-auto flex flex-wrap items-center justify-between gap-3 pt-3 pb-3 border-b border-[#E8DFCE]">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#E0D7C6] shadow-xs flex items-center justify-center">
            <LogoSvg size={36} />
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 block leading-none">
              Agro Planner
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              Syndicate Operations &amp; Livestock Portal
            </span>
          </div>
        </div>
      </header>

      {/* Main Centered Login & Registration Card */}
      <main className="w-full max-w-lg mx-auto my-auto py-4 sm:py-6">
        <div className="bg-white border border-[#E8DFCE] rounded-3xl p-5 sm:p-8 shadow-[0_12px_36px_-8px_rgba(217,119,6,0.08)]">
          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#FAF8F5] border border-[#E8DFCE] rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setErrorMsg('');
              }}
              className={`py-2 px-2 sm:py-2.5 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-colors text-center truncate cursor-pointer ${
                mode === 'LOGIN'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setErrorMsg('');
              }}
              className={`py-2 px-2 sm:py-2.5 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-colors text-center truncate cursor-pointer ${
                mode === 'REGISTER'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register Account
            </button>
          </div>

          <div className="mb-5">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              {mode === 'LOGIN'
                ? 'Welcome Back to Agro Planner'
                : 'Create Your Syndicate Account'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'LOGIN'
                ? 'Authenticate with Google or your registered email and password.'
                : 'Register your identity. If you sign in with Google, you can also add a password anytime in Settings.'}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Google OAuth & Biometric Unlock Buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-slate-900 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 sm:gap-2.5 transition-colors cursor-pointer disabled:opacity-60 text-center"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 20.9 7.4 24 12 24z"
                />
              </svg>
              <span className="truncate">
                {mode === 'LOGIN'
                  ? 'Continue with Google'
                  : 'Register with Google'}
              </span>
            </button>

            {mode === 'LOGIN' && (
              <button
                type="button"
                disabled={loading}
                onClick={handleBiometricSignIn}
                className="w-full py-2.5 px-3 sm:px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Fingerprint className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Sign in with fingerprint</span>
              </button>
            )}
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-[#E8DFCE]" />
            <span className="text-[11px] font-medium text-slate-400">
              or use email &amp; password
            </span>
            <div className="h-[1px] flex-1 bg-[#E8DFCE]" />
          </div>

          {/* Email & Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {mode === 'REGISTER' && (
              <>
                <div>
                  <label
                    htmlFor="auth-fullname"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Full Legal Name *
                  </label>
                  <div className="relative flex items-center">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      id="auth-fullname"
                      type="text"
                      required
                      placeholder="e.g. Marlvin Basera"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="auth-phone"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Phone / WhatsApp *
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                      <input
                        id="auth-phone"
                        type="tel"
                        required
                        placeholder="+263 77 000 0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-10 pr-3 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="auth-title"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Syndicate Position / Note
                    </label>
                    <div className="relative flex items-center">
                      <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                      <input
                        id="auth-title"
                        type="text"
                        placeholder="e.g. Partner / Ground Manager"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Email Address *
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Password *
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={mode === 'REGISTER' ? 'At least 8 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {mode === 'REGISTER' && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Password Strength</span>
                    <span className="font-semibold text-slate-700">{passwordStrength.label}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 h-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`rounded-full transition-colors ${
                          passwordStrength.score >= step
                            ? passwordStrength.score >= 3
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                            : 'bg-[#E8DFCE]'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {mode === 'REGISTER' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Confirm Password *
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <span>
                {loading
                  ? 'Verifying Credentials...'
                  : mode === 'LOGIN'
                  ? 'Sign In to Syndicate Portal'
                  : 'Create Verified Account'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* High-Contrast Signature Footer Card */}
      <footer className="w-full max-w-lg mx-auto pt-2 space-y-2.5">
        <div className="bg-white border-2 border-amber-400/70 rounded-2xl px-4 sm:px-5 py-4 shadow-md flex flex-col items-center justify-between gap-3 text-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm sm:text-base font-black tracking-widest bg-gradient-to-r from-[#B45309] via-[#BE123C] to-[#047857] bg-clip-text text-transparent">
              {DEVELOPER_INFO.company}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs font-extrabold">
            <a
              href={`mailto:${DEVELOPER_INFO.email}`}
              className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-amber-50 border border-[#E8DFCE] flex items-center gap-1.5 font-mono text-slate-900 transition-colors"
            >
              <ModernEmailIcon className="w-4 h-4 shrink-0" />
              <span>{DEVELOPER_INFO.email}</span>
            </a>

            <a
              href={`https://wa.me/${DEVELOPER_INFO.whatsappIntl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-emerald-50 border border-[#E8DFCE] flex items-center gap-1.5 font-mono text-emerald-900 transition-colors"
            >
              <ModernWhatsAppIcon className="w-4 h-4 shrink-0" />
              <span>{DEVELOPER_INFO.phoneDisplay}</span>
            </a>

            <a
              href={DEVELOPER_INFO.linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-sky-50 border border-[#E8DFCE] flex items-center gap-1.5 text-[#0A66C2] transition-colors"
            >
              <ModernLinkedInIcon className="w-4 h-4 shrink-0" />
              <span>{DEVELOPER_INFO.linkedInName}</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
