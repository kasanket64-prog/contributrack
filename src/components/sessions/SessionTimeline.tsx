import { useState } from 'react';
import { Layers, Mic } from 'lucide-react';
import { SessionGlassCard } from './SessionCards';
import type { IotData, Member } from '../../lib/types';

const EXPR_COLOR: Record<string, string> = {
  ENGAGED: '#10B981',
  FOCUSED: '#06B6D4',
  NEUTRAL: '#3B82F6',
  DISTRACTED: '#F59E0B',
  DROWSY: '#F43F5E',
  ABSENT: '#4B5563',
};

export default function SessionTimeline({ logs, members }: { logs: IotData[]; members: Member[] }) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const chronological = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const laneMemberIds = Array.from(new Set(chronological.map((l) => l.member_id ?? l.device_id)));

  const activeLog =
    chronological.find((l) => l.id === selectedLogId) ??
    [...chronological].reverse().find((l) => l.transcript) ??
    chronological[chronological.length - 1] ??
    null;

  return (
    <SessionGlassCard className="p-5">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-indigo-500/0 via-cyan-400/50 to-indigo-500/0" />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <Layers size={14} className="text-indigo-400" />
            Multi-Track Session Timeline
          </h4>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Click any block to inspect posture, engagement score &amp; spoken transcript
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
          {Object.entries(EXPR_COLOR).map(([k, hex]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: hex }} />
              {k.charAt(0) + k.slice(1).toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {chronological.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-6">No telemetry blocks recorded in this session yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2.5 overflow-x-auto pb-1">
            {laneMemberIds.map((laneKey) => {
              const member = members.find((m) => m.id === laneKey || m.device_id === laneKey);
              const laneLogs = chronological.filter((l) => (l.member_id ?? l.device_id) === laneKey);
              const label = member?.name ?? (laneLogs[0]?.members as { name?: string } | null)?.name ?? laneKey;
              return (
                <div key={laneKey} className="flex items-center gap-3 min-w-[420px]">
                  <span className="w-28 truncate text-xs font-semibold text-gray-300 flex-shrink-0">{label}</span>
                  <div className="flex-1 flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1.5 overflow-x-auto">
                    {laneLogs.map((l) => {
                      const expr = l.face_expression ?? (l.face ? 'NEUTRAL' : 'ABSENT');
                      const color = EXPR_COLOR[expr] ?? '#3B82F6';
                      const isPicked = activeLog?.id === l.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setSelectedLogId(l.id)}
                          title={`${label} · ${new Date(l.created_at).toLocaleTimeString()} · ${expr}`}
                          className={`relative h-6 min-w-[14px] flex-1 max-w-[28px] rounded-md transition-all ${
                            isPicked ? 'ring-2 ring-white scale-y-110 z-10' : 'opacity-85 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: color }}
                        >
                          {l.transcript && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white shadow" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {activeLog && (
            <div className="rounded-xl border border-cyan-500/20 bg-black/30 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-white">
                    {members.find((m) => m.id === activeLog.member_id)?.name ??
                      (activeLog.members as { name?: string } | null)?.name ??
                      activeLog.device_id}
                  </span>
                  <span className="font-mono text-[10px] text-gray-400 tabular-nums">
                    {new Date(activeLog.created_at).toLocaleTimeString()}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                    {activeLog.face_expression ?? (activeLog.face ? 'NEUTRAL' : 'ABSENT')}
                  </span>
                  {activeLog.voice_quality && activeLog.voice === 1 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                      <Mic size={9} /> {activeLog.voice_quality}
                    </span>
                  )}
                </div>
                {activeLog.transcript ? (
                  <p className="text-xs italic text-gray-300">&ldquo;{activeLog.transcript}&rdquo;</p>
                ) : (
                  <p className="text-[11px] text-gray-400">
                    {activeLog.voice === 1 ? 'Voice active (no transcript)' : 'Silent / visual observation only'}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0 tabular-nums">
                <p className="text-lg font-black text-cyan-300">
                  {activeLog.engagement_score ?? activeLog.contribution_pct}
                  <span className="text-[10px] text-gray-400 font-normal">/100</span>
                </p>
                <p className="text-[10px] text-gray-400">{activeLog.contribution_level}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </SessionGlassCard>
  );
}
