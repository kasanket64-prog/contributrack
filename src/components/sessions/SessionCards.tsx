import { useEffect, useState } from 'react';
import { Clock, Eye, Loader, Pause, Play, Radio, CircleDashed } from 'lucide-react';
import { MEMBER_COLORS, formatDuration } from '../../lib/dashboardMetrics';
import type { IotData, Member, Session } from '../../lib/types';

export function LiveDuration({ start }: { start: string }) {
  const [label, setLabel] = useState(formatDuration(start));
  useEffect(() => {
    const id = setInterval(() => setLabel(formatDuration(start)), 1000);
    return () => clearInterval(id);
  }, [start]);
  return <span className="tabular-nums">{label}</span>;
}

export function SessionGlassCard({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative bg-white/[0.025] border border-white/8 rounded-2xl overflow-hidden transition-all duration-300 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function ActiveSessionFeed({
  session,
  allMembers,
  memberIds,
  logs,
}: {
  session: Session;
  allMembers: Member[];
  memberIds: string[];
  logs: IotData[];
}) {
  const assignedMembers = allMembers.filter((m) => memberIds.includes(m.id));
  const recentLogs = logs.slice(0, 6);
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-200 truncate">{session.title}</p>
          <p className="text-[10px] text-emerald-400/80 mt-0.5 tabular-nums">
            <LiveDuration start={session.started_at} /> · {assignedMembers.length} member{assignedMembers.length !== 1 ? 's' : ''}
          </p>
        </div>
        {assignedMembers.length > 0 && (
          <div className="flex -space-x-1.5 flex-shrink-0">
            {assignedMembers.slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                className="w-6 h-6 rounded-full border-2 border-[#0B1120] flex items-center justify-center text-white text-[9px] font-bold"
                style={{ backgroundColor: MEMBER_COLORS[allMembers.indexOf(m) % MEMBER_COLORS.length], zIndex: 10 - i }}
              >
                {m.name.charAt(0)}
              </div>
            ))}
          </div>
        )}
        <Eye size={13} className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-emerald-500/10">
          {assignedMembers.length > 0 && (
            <div className="mt-3 space-y-2">
              {assignedMembers.map((m) => {
                const memberLogs = logs.filter((l) => l.member_id === m.id);
                const voiceActive = memberLogs.filter((l) => l.voice).length;
                const pct = memberLogs.length > 0 ? Math.round((voiceActive / memberLogs.length) * 100) : 0;
                const color = MEMBER_COLORS[allMembers.indexOf(m) % MEMBER_COLORS.length];
                return (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: color }}>
                      {m.name.charAt(0)}
                    </div>
                    <span className="text-[11px] text-gray-300 w-24 truncate flex-shrink-0">{m.name.split(' ')[0]}</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[11px] font-bold w-8 text-right tabular-nums flex-shrink-0" style={{ color }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}

          {recentLogs.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Readings</p>
              {recentLogs.map((log) => {
                const lc = log.contribution_level === 'HIGH' ? '#10B981' : log.contribution_level === 'MEDIUM' ? '#F59E0B' : '#EF4444';
                return (
                  <div key={log.id} className="flex items-center gap-2 text-[11px] tabular-nums">
                    <span className="text-gray-400 font-mono w-16 flex-shrink-0">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-gray-300 flex-1 truncate">{(log.members as { name: string } | null)?.name ?? log.device_id}</span>
                    <span className="font-bold w-9 text-right" style={{ color: lc }}>{log.contribution_pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SessionCard({
  s,
  allMembers,
  sessionMemberMap,
  selected,
  onSelect,
  onToggle,
  toggling,
}: {
  s: Session;
  allMembers: Member[];
  sessionMemberMap: Record<string, string[]>;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  const isActive = s.status === 'active';
  const memberIds = sessionMemberMap[s.id] ?? [];
  const sessionMembers = allMembers.filter((m) => memberIds.includes(m.id));

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isActive ? 'border-emerald-500/30 bg-emerald-500/[0.04] shadow-lg shadow-emerald-500/8' : 'border-white/8 bg-white/[0.02]'
      } ${selected ? 'ring-1 ring-blue-500/40' : ''}`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            {isActive ? <Radio size={16} className="text-emerald-400 animate-pulse" /> : <CircleDashed size={16} className="text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-bold text-gray-100 text-sm leading-tight">{s.title}</p>
              {isActive ? (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1 whitespace-nowrap">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />LIVE
                </span>
              ) : s.status === 'completed' ? (
                <span className="text-[9px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">DONE</span>
              ) : null}
            </div>
            {s.description && <p className="text-[11px] text-gray-400 truncate mb-1.5">{s.description}</p>}

            {sessionMembers.length > 0 && (
              <div className="flex items-center gap-1.5 mb-2">
                <div className="flex -space-x-1.5">
                  {sessionMembers.slice(0, 4).map((m, i) => (
                    <div
                      key={m.id}
                      className="w-5 h-5 rounded-full border-2 border-[#0B1120] flex items-center justify-center text-white text-[8px] font-bold"
                      style={{ backgroundColor: MEMBER_COLORS[allMembers.indexOf(m) % MEMBER_COLORS.length], zIndex: 10 - i }}
                    >
                      {m.name.charAt(0)}
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-gray-400 tabular-nums">{sessionMembers.length} member{sessionMembers.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-[10px] text-gray-400 tabular-nums">
              <Clock size={9} />
              {isActive ? <LiveDuration start={s.started_at} /> : formatDuration(s.started_at, s.ended_at)}
              <span>·</span>
              <span>{new Date(s.started_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </button>

      <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          className={`w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-xl border font-semibold transition-all ${
            isActive
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
              : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border-blue-500/25 hover:from-blue-500/30 hover:to-cyan-500/30'
          }`}
        >
          {toggling ? <Loader size={11} className="animate-spin" /> : isActive ? <><Pause size={11} /> Pause</> : <><Play size={11} /> Resume</>}
        </button>
      </div>
    </div>
  );
}
