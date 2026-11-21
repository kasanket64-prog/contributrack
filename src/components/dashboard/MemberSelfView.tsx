import { Award, CheckCircle, ExternalLink, FilePlus2, Lock, Mic, ShieldCheck, Sparkles, Star, Video } from 'lucide-react';
import { getCalibration, type MemberStat, type PeerRatingEntry } from '../../lib/dashboardMetrics';
import { loadSettings, saveSettings, type SensorPrivacyMode } from '../../lib/settings';
import type { ContributionEvidence, IotData, Member, Page } from '../../lib/types';
import { ScoreDial } from './DashboardWidgets';
import GrowthTrendCard from './GrowthTrendCard';

function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export default function MemberSelfView({
  workspaceName,
  members,
  memberStats,
  iotData,
  peerRatings,
  evidence,
  actingMemberId,
  privacyMode,
  onOpenCert,
  onOpenSubmitEvidence,
  navigate,
}: {
  workspaceName: string;
  members: Member[];
  memberStats: MemberStat[];
  iotData: IotData[];
  peerRatings: Record<string, PeerRatingEntry>;
  evidence: ContributionEvidence[];
  actingMemberId: string;
  privacyMode: SensorPrivacyMode;
  onOpenCert: (memberId: string) => void;
  onOpenSubmitEvidence: (memberId: string) => void;
  navigate?: (page: Page) => void;
}) {
  const activeStat =
    memberStats.find((ms) => ms.member.id === actingMemberId) ??
    memberStats[0] ??
    null;

  if (!activeStat) {
    return (
      <div className="p-6 max-w-[1440px] mx-auto">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111114] p-10 text-center">
          <p className="text-sm text-zinc-400">No members in {workspaceName} yet.</p>
        </div>
      </div>
    );
  }

  const cal = getCalibration(activeStat, peerRatings);
  const myEvidence = evidence.filter((ev) => ev.member_id === activeStat.member.id);
  const ins = activeStat.insight;

  const setPrivacy = (mode: SensorPrivacyMode) => {
    const current = loadSettings();
    saveSettings({ ...current, sensorPrivacyMode: mode });
  };

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-[1440px] mx-auto">
      {/* Personal Header Summary */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold text-white"
            style={{ backgroundColor: activeStat.color }}
          >
            {activeStat.member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-white">{activeStat.member.name}</h2>
              <span className="rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-300 uppercase">
                My Private Scorecard · {workspaceName}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {activeStat.member.role} · {activeStat.activeMinutes}m active · {activeStat.wordCount.toLocaleString()} written words
            </p>
            {cal && (
              <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cal.cls}`}>
                <Star size={10} className="fill-amber-400 text-amber-400" />
                Peer Check-In: {cal.rating}/5 · {cal.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-center tabular-nums">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">My Score</p>
            <p className="text-xl font-semibold text-white">
              {activeStat.overallScore}<span className="text-xs text-zinc-500">/100</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-center tabular-nums">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Team Share</p>
            <p className="text-xl font-semibold text-white">{activeStat.contributionPct}%</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenCert(activeStat.member.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
          >
            <Award size={14} /> View &amp; Share Certificate
          </button>
          <button
            type="button"
            onClick={() => onOpenSubmitEvidence(activeStat.member.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] transition-colors"
          >
            <FilePlus2 size={14} /> Submit Offline Evidence / Appeal
          </button>
        </div>
      </section>

      {/* Privacy Consent & Personal Growth Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] space-y-4">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 flex-shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Privacy &amp; Sensor Consent Controls</h3>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                Video frames stay 100% on your device. Teammates never see your raw webcam or drowsiness flags here.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setPrivacy('audio_docs_only')}
              className={`rounded-xl border p-3.5 text-left transition-colors ${
                privacyMode === 'audio_docs_only'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-white'
                  : 'border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:border-white/20'
              }`}
            >
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Mic size={13} className="text-emerald-400" /> Audio &amp; Docs Only
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">Camera disabled; earn credit via voice, docs &amp; commits.</p>
            </button>

            <button
              type="button"
              onClick={() => setPrivacy('camera_audio')}
              className={`rounded-xl border p-3.5 text-left transition-colors ${
                privacyMode === 'camera_audio'
                  ? 'border-white/30 bg-white/[0.07] text-white'
                  : 'border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:border-white/20'
              }`}
            >
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Video size={13} className="text-indigo-400" /> Camera + Audio
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">Local browser presence detection + microphone activity.</p>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={11} className="text-emerald-400" />
              Active consent mode: <strong className="text-white font-medium">{privacyMode === 'audio_docs_only' ? 'Audio & Docs Only (No Camera)' : 'Camera + Audio'}</strong>
            </span>
            <button
              type="button"
              onClick={() => navigate?.('iot')}
              className="text-zinc-200 font-medium hover:underline"
            >
              Open Live Sensor →
            </button>
          </div>
        </section>

        <GrowthTrendCard iotData={iotData} members={members} lockedMemberId={activeStat.member.id} />
      </div>

      {/* Private Breakdown & Coaching */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">My Dimension Breakdown &amp; Private Coaching</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ScoreDial value={activeStat.voiceScore} color="#818CF8" label="Voice" sub="Discussion activity" />
          <ScoreDial value={activeStat.presenceScore} color="#34D399" label="Presence" sub="Focus / Privacy mode" />
          <ScoreDial value={activeStat.writingScore} color="#FBBF24" label="Writing & Code" sub={`${activeStat.wordCount.toLocaleString()} words`} />
          <ScoreDial value={activeStat.consistencyScore} color="#38BDF8" label="Consistency" sub="Sprint cadence" />
        </div>

        {ins && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-xs font-semibold text-emerald-300 mb-2 flex items-center gap-1.5">
                <CheckCircle size={12} /> What You&apos;re Carrying Well
              </p>
              <ul className="space-y-1.5">
                {(ins.strengths as string[]).map((s, idx) => (
                  <li key={idx} className="text-xs text-zinc-300">• {s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-xs font-semibold text-indigo-300 mb-2">Suggested Next Move</p>
              <ul className="space-y-1.5">
                {(ins.improvements as string[]).map((s, idx) => (
                  <li key={idx} className="text-xs text-zinc-300">• {s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* My Offline Evidence & Appeal History */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">My Offline Evidence &amp; Appeal History</h3>
            <p className="text-xs text-zinc-400">Track instructor approval status for work done outside live calls.</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenSubmitEvidence(activeStat.member.id)}
            className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08]"
          >
            + Add Offline Work
          </button>
        </div>

        {myEvidence.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4">
            You haven&apos;t submitted any offline evidence or score appeals yet.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {myEvidence.map((ev) => (
              <div key={ev.id} className="py-3.5 first:pt-1 last:pb-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-white">{ev.title}</span>
                    <span className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-300">
                      {ev.category} · {ev.hours}h
                    </span>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      ev.status === 'approved'
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                        : ev.status === 'needs_info'
                        ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                        : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {ev.status === 'approved' ? 'Approved' : ev.status === 'needs_info' ? 'Needs Info' : 'Pending Review'}
                  </span>
                </div>
                {ev.description && <p className="text-xs text-zinc-300">{ev.description}</p>}
                {ev.reviewer_note && (
                  <p className="text-[11px] text-zinc-400">Instructor note: <span className="text-zinc-200">{ev.reviewer_note}</span></p>
                )}
                {isSafeHttpUrl(ev.evidence_url) && (
                  <a
                    href={ev.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:underline"
                  >
                    View submitted link <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
