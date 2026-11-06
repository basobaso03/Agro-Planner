import React, { useState } from 'react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import {
  UserCheck,
  KeyRound,
  Coins,
  ShieldCheck,
  TrendingUp,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Fingerprint,
} from 'lucide-react';

interface TutorialTopic {
  id: string;
  title: string;
  subtitle: string;
  category: 'ONBOARDING' | 'GOVERNANCE' | 'FINANCE' | 'SECURITY';
  icon: any;
  steps: {
    title: string;
    description: string;
    badge?: string;
  }[];
  importantTip?: string;
}

const TUTORIAL_TOPICS: TutorialTopic[] = [
  {
    id: 'registration',
    title: 'Account Registration & Quick Sign-In',
    subtitle: 'Get started with Google OAuth or verified Email credentials',
    category: 'ONBOARDING',
    icon: UserCheck,
    steps: [
      {
        title: '1. Launch & Select Sign-In Method',
        description:
          'Open Capital Seed and tap "Continue with Google" for instant one-tap authentication, or enter your Email and Password.',
        badge: 'Zero Password Setup needed with Google',
      },
      {
        title: '2. Enable Biometric Fingerprint (Recommended)',
        description:
          'On your first login, the app prompts you to link your Android fingerprint. Enabling this allows instant biometric unlock without typing credentials repeatedly.',
        badge: 'Hardware Key backed',
      },
      {
        title: '3. Workspace Routing',
        description:
          'Once authenticated, you will be prompted to either Create a New Venture Organization (if you are the founder/owner) or Join with an Invite Code (if you were invited by your partner).',
      },
    ],
    importantTip:
      'If you lose your password, you can reset it via the email link on the login screen or re-authenticate securely using Google Sign-In with the same email.',
  },
  {
    id: 'organization-creation',
    title: 'Creating an Organization (Dual Business Split)',
    subtitle: 'Choose between Agro-Farming & Livestock vs General Business Ventures',
    category: 'ONBOARDING',
    icon: Sparkles,
    steps: [
      {
        title: '1. Choose Venture Type',
        description:
          'Select "Agro-Farming & Livestock" if managing cattle, poultry, feed, or paddocks. Select "General Business Venture" if running retail, property, collective trade, or technology projects.',
        badge: 'Agro vs General',
      },
      {
        title: '2. Name Your Organization & Set Starting Capital',
        description:
          'Provide a name for your organization (e.g. "Sunrise Agro Holdings" or "Harare Retail Syndicate") and input any initial treasury capital on the ground.',
      },
      {
        title: '3. Admin Role Assigned Automatically',
        description:
          'The founder who registers the organization is automatically granted the Organization Administrator role with full privileges to manage members and invite codes.',
      },
    ],
    importantTip:
      'General Venture workspaces automatically hide agricultural overhead (livestock pens, feed rations, animal credit sales) to give non-farming teams a clean financial treasury.',
  },
  {
    id: 'invitations',
    title: '24-Hour Invite Codes & Inviting Members',
    subtitle: 'Admin-controlled secret codes that eliminate approval bottlenecks',
    category: 'GOVERNANCE',
    icon: KeyRound,
    steps: [
      {
        title: '1. Accessing the Invite Code',
        description:
          'Organization Admins can tap "24-Hour Invite Code" on the More screen or navigate to Organization Settings to view the active secret code (e.g. "SEED-8492").',
        badge: 'Admin Only',
      },
      {
        title: '2. 24-Hour Expiration & Cost Protection',
        description:
          'Codes expire automatically after 24 hours to prevent unauthorized access. When a code expires, the Admin manually taps "Refresh Invite Code" to generate a fresh one.',
        badge: '24-Hr TTL',
      },
      {
        title: '3. Member Joining Process',
        description:
          'The new member opens Capital Seed, selects "Join Existing Organization", pastes the secret code, and taps "Verify Code & Join". Access is granted immediately with zero delay.',
      },
      {
        title: '4. Welcome Note & Org Briefing',
        description:
          'Upon successful joining, new members receive an instant welcome briefing displaying the organization name, venture type, and their assigned role.',
      },
    ],
    importantTip:
      'Manual code refreshing keeps Firebase cloud costs minimal while guaranteeing that expired codes can never be reused by former partners.',
  },
  {
    id: 'pledges-and-contributions',
    title: 'Capital Targets, Member Pledges & Receipts',
    subtitle: 'Live progress bars tracking individual & pooled equity deposits',
    category: 'FINANCE',
    icon: Coins,
    steps: [
      {
        title: '1. Set Agreed Member Target',
        description:
          'Each member has an agreed target contribution amount (e.g. $1,000 USD). Admins or members can configure this in Member Settings with monthly or custom pacing.',
      },
      {
        title: '2. Recording a Capital Pay-In',
        description:
          'Tap "+ Deposit Capital" from the Overview or Capital Pool screen. Enter the amount paid, payment method (Ecocash, USD Cash, Bank Transfer), and attach a photo of the receipt.',
        badge: 'Proof Required',
      },
      {
        title: '3. Real-Time Equity & NAV Calculation',
        description:
          'The system calculates each partner\'s equity share percentage automatically in real time. All funds are added to Master Left Money and increment member progress bars.',
      },
    ],
    importantTip:
      'Every capital deposit is permanently preserved in the immutable audit log and can never be silently altered or deleted.',
  },
  {
    id: 'runway-planning',
    title: 'Runway Capital Planning & Spend Gating',
    subtitle: 'Model project costs to break-even and enforce liquidity rules',
    category: 'FINANCE',
    icon: TrendingUp,
    steps: [
      {
        title: '1. Launch the 5-Step Runway Wizard',
        description:
          'From the Money tab, tap "Launch Runway Wizard". Configure cycle name, start date, target funding deadline, and estimated break-even milestone.',
      },
      {
        title: '2. Add Budget Cost Lines & Contingency Buffer',
        description:
          'Input your planned expenses (one-off equipment, recurring feeds, operational costs). Add a 10% or custom fixed contingency reserve to protect against unexpected price increases.',
      },
      {
        title: '3. Suggest Pledge Splits',
        description:
          'The wizard calculates the exact dollar pledge required from each partner down to the cent, subtracting any opening cash already adopted from the treasury.',
      },
      {
        title: '4. Strict Spend-Gating Rule',
        description:
          'When executing a runway spend, the engine verifies TWO conditions: (1) Does the budget line have remaining funds? AND (2) Is there enough physical cash in the treasury? If ground cash is insufficient, the expense is blocked!',
        badge: 'Dual-Check Protection',
      },
    ],
    importantTip:
      'True liquidity gating prevents your group from spending money that partners have promised but not yet physically deposited.',
  },
  {
    id: 'security-and-privacy',
    title: 'Biometric Lock, Privacy Masking & Audit Trail',
    subtitle: 'Bank-grade financial privacy, verified records & SHA-256 integrity',
    category: 'SECURITY',
    icon: ShieldCheck,
    steps: [
      {
        title: '1. Biometric Eye-Shield Privacy',
        description:
          'When unlocking the app with your fingerprint in public, sensitive financial figures (pool money, member equity, revenue) are masked with dots automatically.',
        badge: 'Auto Eye-Shield',
      },
      {
        title: '2. One-Tap Mask / Unmask',
        description:
          'Tap the eye icon on the header or More screen to toggle figure masking whenever showing the app to colleagues or third parties.',
      },
      {
        title: '3. SHA-256 Audit Chain Inspector',
        description:
          'Navigate to the Audit Trail screen to inspect individual transaction blocks. Each block is cryptographically linked to the previous block hash.',
      },
      {
        title: '4. 11 Standardized Zero-Underscore PDF Reports',
        description:
          'Export tamper-proof PDF reports (Runway Plans, Balance Sheets, Health Certificates, Invoices) with clean, underscore-free filenames ready to share on WhatsApp or Email.',
      },
    ],
    importantTip:
      'You can verify the entire cryptographic audit chain anytime by tapping "Verify Hash Chain" on the Audit Ledger screen.',
  },
];

export const TutorialScreen: React.FC = () => {
  const { navigate } = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedTopic, setExpandedTopic] = useState<string>('registration');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTopics = TUTORIAL_TOPICS.filter((t) => {
    if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchSub = t.subtitle.toLowerCase().includes(q);
      const matchSteps = t.steps.some(
        (s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
      if (!matchTitle && !matchSub && !matchSteps) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
            Official Platform User Guide
          </span>
          <span className="text-xs font-mono font-bold text-emerald-300">Capital Seed v1.0.5</span>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            Capital Seed Quickstart Tutorials
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed mt-1">
            Master the essentials of registration, 24-hr organization invite codes, capital target pledges,
            milestone runway planning, and tamper-proof audit verification.
          </p>
        </div>

        {/* Search Bar */}
        <div className="pt-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tutorials (e.g. invite codes, runway, receipts, biometrics)..."
            className="w-full bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder:text-emerald-200/60 focus:placeholder:text-slate-400 border border-white/20 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        {[
          { id: 'ALL', label: 'All Guides' },
          { id: 'ONBOARDING', label: 'Registration & Onboarding' },
          { id: 'GOVERNANCE', label: 'Invite Codes & Roles' },
          { id: 'FINANCE', label: 'Pledges & Runway' },
          { id: 'SECURITY', label: 'Biometrics & Audit' },
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${selectedCategory === cat.id
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white border border-[#E8DFCE] text-slate-700 hover:bg-[#FAF8F5]'
              }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Topics List */}
      <div className="space-y-3">
        {filteredTopics.map((topic) => {
          const isExpanded = expandedTopic === topic.id;
          const Icon = topic.icon;

          return (
            <div
              key={topic.id}
              className="bg-white border border-[#E8DFCE] rounded-2xl shadow-xs overflow-hidden transition-all"
            >
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => setExpandedTopic(isExpanded ? '' : topic.id)}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-[#FAF8F5] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-slate-900 leading-tight">
                      {topic.title}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                      {topic.subtitle}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-slate-400">
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-amber-600" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </button>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-[#F0EBE1] space-y-4">
                  {/* Step by step list */}
                  <div className="space-y-3 pt-2">
                    {topic.steps.map((step, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-900">
                            {step.title}
                          </span>
                          {step.badge && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0">
                              {step.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {step.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Pro-Tip Box */}
                  {topic.importantTip && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-extrabold text-amber-900 block">Pro-Tip:</strong>
                        <span className="leading-relaxed text-amber-900/90 font-medium">{topic.importantTip}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Navigation Footer Card */}
      <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs font-medium text-slate-600">
            Need hands-on guidance or custom configuration?
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('settings')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer"
        >
          <span>Open Settings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

