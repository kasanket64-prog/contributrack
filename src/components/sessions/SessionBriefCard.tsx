import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDuration } from '../../lib/dashboardMetrics';
import { SessionGlassCard } from './SessionCards';
import type { IotData, Member, Session, SessionAction } from '../../lib/types';

export default function SessionBriefCard({
  workspaceId,
  session,
  logs,
  assignedMembers,
}: {
  workspaceId: string;
  session: Session;
  logs: IotData[];
  assignedMembers: Member[];
}) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: persistedActions = [] } = useQuery({
    queryKey: ['session-actions', workspaceId, session.id],
    queryFn: async ({ signal }) => {
      const { data } = await supabase
        .from('session_actions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('session_id', session.id)
        .abortSignal(signal);
      return (data ?? []) as SessionAction[];
    },
  });

  const checkedMap: Record<string, boolean> = {};
  for (const row of persistedActions) {
    checkedMap[row.action_key] = row.done;
  }

  const total = logs.length;
  const activeCount = logs.filter((l) => l.is_actively_engaged || l.voice === 1).length;
  const activeRatio = total > 0 ? Math.round((activeCount / total) * 100) : 0;
  const topics = Array.from(new Set(logs.flatMap((l) => l.voice_topics ?? []))).slice(0, 8);
  const drowsyCount = logs.filter((l) => l.face_expression === 'DROWSY').length;

  const healthVerdict =
    total === 0
      ? 'Awaiting Telemetry'
      : activeRatio >= 70 && drowsyCount <= 2
      ? 'Healthy Collaboration'
      : activeRatio >= 45
      ? 'Moderate Focus'
      : 'Needs Re-engagement';

  const healthCls =
    healthVerdict === 'Healthy Collaboration'
      ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
      : healthVerdict === 'Moderate Focus'
      ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
      : 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30';

  const actionItems: { id: string; owner: string; task: string }[] = [];
  const transcriptLogs = logs.filter((l) => l.transcript && l.voice_quality !== 'OFF_TOPIC' && l.voice_quality !== 'DISRUPTIVE');
  for (const l of transcriptLogs.slice(0, 4)) {
    const owner =
      assignedMembers.find((m) => m.id === l.member_id)?.name ??
      (l.members as { name?: string } | null)?.name ??
      l.device_id;
    actionItems.push({
      id: `${session.id}:${l.id}`,
      owner,
      task: l.transcript!,
    });
  }
  if (actionItems.length === 0) {
    for (const m of assignedMembers.slice(0, 3)) {
      actionItems.push({
        id: `${session.id}:default:${m.id}`,
        owner: m.name,
        task: `Follow up on ${session.title} deliverables (${m.role})`,
      });
    }
  }

  const toggleItem = async (item: { id: string; owner: string; task: string }) => {
    const nextDone = !checkedMap[item.id];
    // Optimistically update React Query cache immediately
    qc.setQueryData<SessionAction[]>(['session-actions', workspaceId, session.id], (old = []) => {
      const idx = old.findIndex((r) => r.action_key === item.id);
      if (idx >= 0) {
        const copy = [...old];
        copy[idx] = { ...copy[idx], done: nextDone };
        return copy;
      }
      return [
        ...old,
        {
          id: item.id,
          workspace_id: workspaceId,
          session_id: session.id,
          action_key: item.id,
          label: `${item.owner}: ${item.task}`,
          done: nextDone,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ];
    });

    await supabase.from('session_actions').upsert(
      {
        workspace_id: workspaceId,
        session_id: session.id,
        action_key: item.id,
        label: `${item.owner}: ${item.task}`,
        done: nextDone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,session_id,action_key' },
    );
    void qc.invalidateQueries({ queryKey: ['session-actions', workspaceId, session.id] });
  };

  const durationText =
    session.status === 'active'
      ? formatDuration(session.started_at)
      : formatDuration(session.started_at, session.ended_at);

  const summaryText = `Session "${session.title}" ran for ${durationText} across ${total} sensor readings with ${activeRatio}% active participation across ${assignedMembers.length} assigned member(s). ${
    topics.length > 0 ? `Key topics covered: ${topics.join(', ')}. ` : ''
  }${drowsyCount > 0 ? `${drowsyCount} drowsy reading(s) flagged for follow-up.` : 'Focus levels remained steady.'}`;

  const copyMarkdown = async () => {
    const md = [
      `# AI Session Brief — ${session.title}`,
      `**Health:** ${healthVerdict} | **Duration:** ${durationText} | **Active Ratio:** ${activeRatio}%`,
      '',
      '## Executive Summary',
      summaryText,
      '',
      '## Action Items',
      ...actionItems.map((a) => `- [${checkedMap[a.id] ? 'x' : ' '}] **${a.owner}**: ${a.task}`),
    ].join('\n');
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SessionGlassCard className="p-5">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-cyan-500/0 via-cyan-400/60 to-indigo-500/0" />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Sparkles size={14} className="text-cyan-300" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">AI Session Brief &amp; Action Items</h4>
            <p className="text-[11px] text-gray-400">Auto-synthesized meeting minutes &amp; workspace-persisted follow-ups</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${healthCls}`}>{healthVerdict}</span>
          <button
            type="button"
            onClick={() => void copyMarkdown()}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-gray-200 hover:bg-white/[0.08]"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied Brief' : 'Copy Brief (MD)'}
          </button>
        </div>
      </div>

      <p className="rounded-xl border border-white/8 bg-white/[0.025] p-3.5 text-xs leading-relaxed text-gray-300 mb-4">{summaryText}</p>

      {actionItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 tabular-nums">
            Action Items ({actionItems.filter((a) => checkedMap[a.id]).length}/{actionItems.length} done)
          </p>
          {actionItems.map((item) => {
            const done = Boolean(checkedMap[item.id]);
            return (
              <label key={item.id} className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 cursor-pointer hover:bg-white/[0.04]">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => void toggleItem(item)}
                  className="mt-0.5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500"
                />
                <span className={`text-xs leading-relaxed ${done ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                  <strong className="text-cyan-300">{item.owner}:</strong> {item.task}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </SessionGlassCard>
  );
}
