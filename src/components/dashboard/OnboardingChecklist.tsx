import { CheckCircle2, Circle, Compass, FileText, Radio, Star, Users, X } from 'lucide-react';
import { GlassCard } from './DashboardWidgets';
import type { Page } from '../../lib/types';

export default function OnboardingChecklist({
  membersCount,
  iotCount,
  docCount,
  peerReviewCount,
  evidenceCount,
  navigate,
  onOpenPeerModal,
  onDismiss,
}: {
  membersCount: number;
  iotCount: number;
  docCount: number;
  peerReviewCount: number;
  evidenceCount: number;
  navigate?: (page: Page) => void;
  onOpenPeerModal: () => void;
  onDismiss: () => void;
}) {
  const step1Done = membersCount >= 2;
  const step2Done = iotCount > 0 || docCount > 0;
  const step3Done = peerReviewCount > 0 || evidenceCount > 0;
  const completedCount = [step1Done, step2Done, step3Done].filter(Boolean).length;

  return (
    <GlassCard className="no-print">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-cyan-500/0 via-cyan-400/60 to-emerald-400/0" />
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/15 text-cyan-300 flex-shrink-0">
              <Compass size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  3-Step Workspace Quickstart
                </h3>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-200 tabular-nums">
                  {completedCount}/3 completed
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Get fair team contribution scores in under 2 minutes without manual spreadsheets.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss quickstart checklist"
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:bg-white/[0.08] hover:text-white"
          >
            <X size={12} /> Dismiss
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Step 1 */}
          <div className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 ${step1Done ? 'border-emerald-500/25 bg-emerald-500/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
            <div className="flex items-start gap-2">
              {step1Done ? <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <Circle size={15} className="text-gray-500 flex-shrink-0 mt-0.5" />}
              <div>
                <p className="text-xs font-bold text-white">1. Build Your Team</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{membersCount} members registered via invite or CSV.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate?.('members')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
            >
              <Users size={12} /> Invite / Import
            </button>
          </div>

          {/* Step 2 */}
          <div className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 ${step2Done ? 'border-emerald-500/25 bg-emerald-500/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
            <div className="flex items-start gap-2">
              {step2Done ? <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <Circle size={15} className="text-gray-500 flex-shrink-0 mt-0.5" />}
              <div>
                <p className="text-xs font-bold text-white">2. Capture Activity</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Sync GitHub/Docs ({docCount}) or stream Audio/Cam ({iotCount}).</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => navigate?.('documents')}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2 py-1.5 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-500/20 whitespace-nowrap"
              >
                <FileText size={11} /> Sync GitHub / Docs
              </button>
              <button
                type="button"
                onClick={() => navigate?.('iot')}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 whitespace-nowrap"
              >
                <Radio size={11} /> Live Sensor
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 ${step3Done ? 'border-emerald-500/25 bg-emerald-500/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
            <div className="flex items-start gap-2">
              {step3Done ? <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <Circle size={15} className="text-gray-500 flex-shrink-0 mt-0.5" />}
              <div>
                <p className="text-xs font-bold text-white">3. Calibrate Fairness &amp; Evidence</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{peerReviewCount} peer check-ins · {evidenceCount} offline appeals.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenPeerModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20"
            >
              <Star size={12} /> 360° Peer Check-In
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-gray-400 leading-relaxed">
          <strong className="text-gray-200">How Fairness Is Measured:</strong>{' '}
          <span className="text-cyan-300 font-semibold">StdDev</span> rewards steady participation across teammates,{' '}
          <span className="text-cyan-300 font-semibold">Gini</span> flags when one person carries most work, and{' '}
          <span className="text-cyan-300 font-semibold">Range</span> tracks top-to-bottom spread (higher = more balanced).
        </div>
      </div>
    </GlassCard>
  );
}
