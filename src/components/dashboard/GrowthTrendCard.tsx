import { useState } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { computeGrowthTrends } from '../../lib/dashboardMetrics';
import type { IotData, Member } from '../../lib/types';
import LineChart from '../charts/LineChart';
import { GlassCard } from './DashboardWidgets';

export default function GrowthTrendCard({
  iotData,
  members,
  lockedMemberId,
}: {
  iotData: IotData[];
  members: Member[];
  lockedMemberId?: string;
}) {
  const [selectedMemberId, setSelectedMemberId] = useState(lockedMemberId ?? '');
  const activeMemberFilter = lockedMemberId ?? selectedMemberId;
  const trend = computeGrowthTrends(iotData, activeMemberFilter || undefined);

  const deltaTone =
    trend.delta > 2
      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
      : trend.delta < -2
      ? 'border-rose-500/30 bg-rose-500/15 text-rose-300'
      : 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300';

  const DeltaIcon = trend.delta > 2 ? TrendingUp : trend.delta < -2 ? TrendingDown : Minus;

  return (
    <GlassCard>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-indigo-500/0 via-indigo-400/60 to-cyan-400/0" />
      <div className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-white text-sm">Sprint Growth Trend</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Engagement trajectory across chronological checkpoints
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ${deltaTone}`}>
              <DeltaIcon size={11} />
              {trend.delta > 0 ? `+${trend.delta} pts` : trend.delta < 0 ? `${trend.delta} pts` : 'Steady'}
            </span>

            {!lockedMemberId && (
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                aria-label="Filter growth trend by member"
                className="rounded-xl border border-white/10 bg-[#0B1222] px-2.5 py-1 text-xs text-gray-200 focus:border-cyan-400/50 focus:outline-none"
              >
                <option value="">Team Average</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <LineChart data={trend.points} color="#818CF8" height={125} />

        <div className="flex items-center justify-between text-[11px] text-gray-400 tabular-nums">
          <span>Start window: <strong className="text-gray-200">{trend.earliest}%</strong></span>
          <span>Latest window: <strong className="text-indigo-300">{trend.latest}%</strong></span>
        </div>
      </div>
    </GlassCard>
  );
}
