import { useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { computeGrowthTrends, type MemberStat } from '../../lib/dashboardMetrics';
import type { IotData, Member } from '../../lib/types';
import BarChart from '../charts/BarChart';
import LineChart from '../charts/LineChart';
import PieChart from '../charts/PieChart';

type CanvasMode = 'matrix' | 'growth' | 'share_output';
type OutputMetric = 'words' | 'minutes';

export default function AnalyticsCanvasCard({
  iotData,
  members,
  memberStats,
  analyzing,
}: {
  iotData: IotData[];
  members: Member[];
  memberStats: MemberStat[];
  analyzing: boolean;
}) {
  const [mode, setMode] = useState<CanvasMode>('matrix');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [outputMetric, setOutputMetric] = useState<OutputMetric>('words');

  const rankedStats = memberStats.slice().sort((a, b) => b.overallScore - a.overallScore);

  const trend = computeGrowthTrends(iotData, selectedMemberId || undefined);
  const deltaTone =
    trend.delta > 2
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
      : trend.delta < -2
      ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
      : 'text-zinc-300 bg-white/[0.04] border-white/[0.08]';
  const DeltaIcon = trend.delta > 2 ? TrendingUp : trend.delta < -2 ? TrendingDown : Minus;

  const pieData = memberStats
    .filter((m) => m.contributionPct > 0)
    .map((m) => ({ label: m.member.name, value: m.contributionPct, color: m.color }));

  const writingData = memberStats
    .filter((m) => m.wordCount > 0)
    .map((m) => ({ label: m.member.name.split(' ')[0], value: m.wordCount, color: m.color }))
    .slice(0, 6);

  const activeData = memberStats
    .filter((m) => m.activeMinutes > 0)
    .map((m) => ({ label: m.member.name.split(' ')[0], value: m.activeMinutes, color: m.color }))
    .slice(0, 6);

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex flex-col justify-between gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Contribution Analytics</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {mode === 'matrix'
              ? 'Ranked multimodal breakdown across voice, presence, and written output'
              : mode === 'growth'
              ? 'Chronological engagement trajectory across sprint checkpoints'
              : 'Team share distribution paired with written and time output'}
          </p>
        </div>

        {/* Clean Monochrome Segmented Pill */}
        <div className="inline-flex items-center rounded-lg border border-white/[0.07] bg-zinc-900/90 p-0.5">
          {(
            [
              { id: 'matrix', label: 'Contribution Matrix' },
              { id: 'growth', label: 'Sprint Growth' },
              { id: 'share_output', label: 'Share & Output' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === opt.id ? 'bg-white/[0.1] text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'matrix' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3 text-[11px] text-zinc-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#818CF8]" /> Voice
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#34D399]" /> Presence
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#FBBF24]" /> Writing
              </span>
            </div>
            <span className="hidden sm:inline text-zinc-500">Ranked by Overall Score</span>
          </div>

          {rankedStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
              <TrendingUp size={22} className="mb-2 opacity-30" />
              <p className="text-xs">{analyzing ? 'Calculating contribution matrix…' : 'No member metrics yet'}</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {rankedStats.map((ms) => {
                const vWidth = Math.round((ms.voiceScore / 3) * 10) / 10;
                const pWidth = Math.round((ms.presenceScore / 3) * 10) / 10;
                const wWidth = Math.round((ms.writingScore / 3) * 10) / 10;
                return (
                  <div key={ms.member.id} className="grid grid-cols-12 items-center gap-3">
                    <div className="col-span-5 sm:col-span-4 flex items-center gap-2.5 min-w-0">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                        style={{ backgroundColor: ms.color }}
                      >
                        {ms.member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-zinc-100">{ms.member.name}</p>
                        <p className="truncate text-[10px] text-zinc-500">{ms.member.role}</p>
                      </div>
                    </div>

                    <div
                      className="col-span-4 sm:col-span-5"
                      title={`Voice: ${ms.voiceScore} · Presence: ${ms.presenceScore} · Writing: ${ms.writingScore}`}
                    >
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        {vWidth > 0 && (
                          <div className="h-full bg-[#818CF8]" style={{ width: `${vWidth}%` }} />
                        )}
                        {pWidth > 0 && (
                          <div className="h-full bg-[#34D399]" style={{ width: `${pWidth}%` }} />
                        )}
                        {wWidth > 0 && (
                          <div className="h-full bg-[#FBBF24]" style={{ width: `${wWidth}%` }} />
                        )}
                      </div>
                    </div>

                    <div className="col-span-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                      <span className="font-semibold text-white">{ms.overallScore}</span>
                      <span className="text-zinc-500">/100</span>
                      <span className="ml-2 text-zinc-400">({ms.contributionPct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mode === 'growth' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              aria-label="Filter sprint growth by member"
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-200 focus:border-white/25 focus:outline-none [&>option]:bg-[#111114]"
            >
              <option value="">Team Average</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium tabular-nums ${deltaTone}`}
            >
              <DeltaIcon size={11} />
              {trend.delta > 0 ? `+${trend.delta} pts` : trend.delta < 0 ? `${trend.delta} pts` : 'Steady'}
            </span>
          </div>

          <LineChart data={trend.points} color="#818CF8" height={220} />

          <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-zinc-400 tabular-nums">
            <span>
              Start window: <strong className="text-zinc-200 font-medium">{trend.earliest}%</strong>
            </span>
            <span>
              Latest window: <strong className="text-indigo-300 font-medium">{trend.latest}%</strong>
            </span>
          </div>
        </div>
      )}

      {mode === 'share_output' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center py-1">
          <div className="flex flex-col items-center md:items-start gap-3">
            <p className="text-xs font-medium text-zinc-400">Participation Share</p>
            {pieData.length > 0 ? (
              <PieChart data={pieData} size={175} />
            ) : (
              <div className="flex items-center justify-center h-44 text-xs text-zinc-500">
                No share data yet
              </div>
            )}
          </div>

          <div className="space-y-3 border-t md:border-t-0 md:border-l border-white/[0.06] pt-4 md:pt-0 md:pl-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-400">
                {outputMetric === 'words' ? 'Written Output (Words)' : 'Active Time (Minutes)'}
              </p>
              <div className="inline-flex rounded-md border border-white/[0.07] bg-zinc-900/90 p-0.5">
                <button
                  type="button"
                  onClick={() => setOutputMetric('words')}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                    outputMetric === 'words' ? 'bg-white/[0.1] text-white' : 'text-zinc-400'
                  }`}
                >
                  Words
                </button>
                <button
                  type="button"
                  onClick={() => setOutputMetric('minutes')}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                    outputMetric === 'minutes' ? 'bg-white/[0.1] text-white' : 'text-zinc-400'
                  }`}
                >
                  Minutes
                </button>
              </div>
            </div>

            {outputMetric === 'words' ? (
              writingData.length > 0 ? (
                <BarChart data={writingData} height={175} />
              ) : (
                <div className="flex items-center justify-center h-40 text-xs text-zinc-500">
                  No documents linked yet
                </div>
              )
            ) : activeData.length > 0 ? (
              <BarChart data={activeData} height={175} />
            ) : (
              <div className="flex items-center justify-center h-40 text-xs text-zinc-500">
                No active time recorded yet
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
