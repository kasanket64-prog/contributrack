import { ArrowRight } from 'lucide-react';
import type { CoachingNudge, MemberStat } from '../../lib/dashboardMetrics';
import type { FairnessMethod } from '../../lib/settings';
import { FairnessGauge } from './DashboardWidgets';

export default function TeamHealthRail({
  fairnessScore,
  fairnessMethod,
  memberStats,
  coachingNudges,
  pendingEvidenceCount,
  onGoToInsights,
  onGoToTeam,
}: {
  fairnessScore: number;
  fairnessMethod: FairnessMethod;
  memberStats: MemberStat[];
  coachingNudges: CoachingNudge[];
  pendingEvidenceCount: number;
  onGoToInsights: () => void;
  onGoToTeam: () => void;
}) {
  const shares = memberStats.filter((m) => m.readingCount > 0 || m.contributionPct > 0).map((m) => m.contributionPct);
  const topShare = shares.length ? Math.max(...shares) : 0;
  const lowestShare = shares.length ? Math.min(...shares) : 0;

  const dotColor = (tone: CoachingNudge['tone']) =>
    tone === 'rose' ? 'bg-rose-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-indigo-400';

  return (
    <aside className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex flex-col justify-between gap-5">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Team Health &amp; Balance</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Contribution equity across active participants</p>
        </div>

        <FairnessGauge score={fairnessScore} />

        {/* 3-Column Mini Balance Strip */}
        <div className="grid grid-cols-3 border-t border-white/[0.06] pt-3 text-center tabular-nums">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Top Share</p>
            <p className="mt-0.5 text-xs font-semibold text-zinc-100">{topShare}%</p>
          </div>
          <div className="border-x border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Lowest</p>
            <p className="mt-0.5 text-xs font-semibold text-zinc-100">{lowestShare}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Model</p>
            <p className="mt-0.5 text-xs font-semibold uppercase text-zinc-100">{fairnessMethod}</p>
          </div>
        </div>
      </div>

      {/* Actionable Coach Signals — hairline divided, no boxes-in-boxes */}
      <div className="space-y-2 border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Coach Signals</p>
          {coachingNudges.length > 2 && (
            <button
              type="button"
              onClick={onGoToInsights}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 hover:text-white"
            >
              View all <ArrowRight size={11} />
            </button>
          )}
        </div>

        {coachingNudges.length === 0 ? (
          <p className="py-2 text-xs text-zinc-400">
            Participation looks balanced across active members.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {coachingNudges.slice(0, 2).map((nudge) => (
              <div key={nudge.id} className="flex items-start gap-2.5 py-2.5 first:pt-1 last:pb-0 text-xs leading-relaxed text-zinc-300">
                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColor(nudge.tone)}`} />
                <span>{nudge.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingEvidenceCount > 0 && (
        <button
          type="button"
          onClick={onGoToTeam}
          className="flex w-full items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-left text-xs font-medium text-amber-300 hover:text-amber-200 transition-colors"
        >
          <span>
            {pendingEvidenceCount} offline appeal{pendingEvidenceCount === 1 ? '' : 's'} awaiting review
          </span>
          <ArrowRight size={13} className="flex-shrink-0" />
        </button>
      )}
    </aside>
  );
}
