import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Check, Loader, Clock, Activity, Users, UserPlus, UserMinus,
  Radio, CheckCircle2, Layers, Pencil, Trash2, Sparkles, Share2, ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MEMBER_COLORS, formatDuration } from '../lib/dashboardMetrics';
import { useSessionsQuery, useWorkspaceId } from '../hooks/useWorkspaceQueries';
import {
  ActiveSessionFeed,
  LiveDuration,
  SessionCard,
  SessionGlassCard,
} from '../components/sessions/SessionCards';
import SessionBriefCard from '../components/sessions/SessionBriefCard';
import SessionTimeline from '../components/sessions/SessionTimeline';
import type { RouteParams } from '../lib/router';
import type { IotData, Page, Session, WorkspaceInvite } from '../lib/types';

const initForm = { title: '', description: '' };

export default function Sessions({
  initialSessionId,
  onSelectSessionId,
  navigate,
}: {
  initialSessionId?: string;
  onSelectSessionId?: (sessionId?: string) => void;
  navigate?: (page: Page, params?: RouteParams) => void;
}) {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useSessionsQuery(workspaceId);

  const sessions = data?.sessions ?? [];
  const allMembers = data?.members ?? [];
  const sessionMemberMap = data?.sessionMemberMap ?? {};

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId ?? null);
  const [showForm, setShowForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [briefVisibleFor, setBriefVisibleFor] = useState<Record<string, boolean>>({});
  const [sharingInvite, setSharingInvite] = useState(false);
  const [sessionJoinCode, setSessionJoinCode] = useState<string | null>(null);
  const [copiedJoin, setCopiedJoin] = useState(false);

  useEffect(() => {
    if (initialSessionId) setSelectedSessionId(initialSessionId);
  }, [initialSessionId]);

  useEffect(() => {
    if (!initialSessionId) setSelectedSessionId(null);
  }, [workspaceId, initialSessionId]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;

  const { data: logsMap = {} } = useQuery({
    queryKey: ['session-logs', workspaceId, selectedSessionId, sessions.filter((s) => s.status === 'active').map((s) => s.id).join(',')],
    refetchInterval: 4000,
    queryFn: async ({ signal }) => {
      const targetIds = Array.from(
        new Set([
          ...sessions.filter((s) => s.status === 'active').map((s) => s.id),
          ...(selectedSessionId ? [selectedSessionId] : []),
        ]),
      );
      if (targetIds.length === 0) return {} as Record<string, IotData[]>;
      const entries = await Promise.all(
        targetIds.map(async (id) => {
          const { data: rows } = await supabase
            .from('iot_data')
            .select('*, members(name)')
            .eq('session_id', id)
            .order('created_at', { ascending: false })
            .limit(50)
            .abortSignal(signal);
          return [id, (rows ?? []) as unknown as IotData[]] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
  });

  const refreshSessions = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['sessions', workspaceId] }),
      qc.invalidateQueries({ queryKey: ['session-logs', workspaceId] }),
      qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] }),
    ]);
  };

  const selectSession = (s: Session | null) => {
    setSelectedSessionId(s?.id ?? null);
    setShowAssign(false);
    setSessionJoinCode(null);
    setCopiedJoin(false);
    onSelectSessionId?.(s?.id);
  };

  const handleShareJoinLink = async (s: Session) => {
    setSharingInvite(true);
    try {
      const { data: existing } = await supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('session_id', s.id)
        .maybeSingle();

      let code = (existing as WorkspaceInvite | null)?.code ?? '';
      if (!code) {
        const candidate = `SESS-${s.id.slice(0, 6).toUpperCase()}`;
        const { data: created } = await supabase
          .from('workspace_invites')
          .upsert(
            { workspace_id: workspaceId, session_id: s.id, code: candidate, role: 'member', created_by: 'instructor' },
            { onConflict: 'code' },
          )
          .select('*')
          .maybeSingle();
        code = (created as WorkspaceInvite | null)?.code ?? candidate;
      }

      setSessionJoinCode(code);
      const joinUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/join/${code}` : `/join/${code}`;
      try {
        await navigator.clipboard.writeText(joinUrl);
      } catch {
        /* ignore clipboard refusal */
      }
      setCopiedJoin(true);
      setTimeout(() => setCopiedJoin(false), 2500);
    } finally {
      setSharingInvite(false);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingSessionId) {
        const { error: err } = await supabase.from('sessions').update({ title: form.title.trim(), description: form.description.trim() }).eq('id', editingSessionId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('sessions').insert({
          workspace_id: workspaceId,
          title: form.title.trim(),
          description: form.description.trim(),
        });
        if (err) throw err;
      }
      setForm(initForm);
      setShowForm(false);
      setEditingSessionId(null);
      await refreshSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save session.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSession = async (s: Session) => {
    setTogglingId(s.id);
    const newStatus = s.status === 'active' ? 'paused' : 'active';
    await supabase
      .from('sessions')
      .update({ status: newStatus, ended_at: newStatus === 'paused' ? new Date().toISOString() : null })
      .eq('id', s.id);
    await refreshSessions();
    setTogglingId(null);
  };

  const completeSession = async (s: Session) => {
    setTogglingId(s.id);
    await supabase.from('sessions').update({ status: 'completed', ended_at: s.ended_at ?? new Date().toISOString() }).eq('id', s.id);
    await refreshSessions();
    setTogglingId(null);
  };

  const deleteSession = async (s: Session) => {
    if (!confirm(`Delete session "${s.title}"? Associated sensor logs will remain unlinked.`)) return;
    setDeletingId(s.id);
    await supabase.from('sessions').delete().eq('id', s.id);
    if (selectedSessionId === s.id) selectSession(null);
    await refreshSessions();
    setDeletingId(null);
  };

  const toggleMember = async (memberId: string) => {
    if (!selectedSession) return;
    setAssigningId(memberId);
    const assigned = (sessionMemberMap[selectedSession.id] ?? []).includes(memberId);
    if (assigned) {
      await supabase.from('session_members').delete().eq('session_id', selectedSession.id).eq('member_id', memberId);
    } else {
      await supabase.from('session_members').insert({ session_id: selectedSession.id, member_id: memberId });
    }
    await refreshSessions();
    setAssigningId(null);
  };

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const pausedSessions = sessions.filter((s) => s.status !== 'active');
  const assignedMemberIds = selectedSession ? (sessionMemberMap[selectedSession.id] ?? []) : [];
  const assignedMembers = allMembers.filter((m) => assignedMemberIds.includes(m.id));
  const selectedLogs = selectedSession ? (logsMap[selectedSession.id] ?? []) : [];

  return (
    <div className="relative p-6 space-y-5 min-h-full overflow-hidden">
      <div className="fixed top-20 right-20 w-96 h-96 rounded-full bg-blue-600/5 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-20 left-80 w-80 h-80 rounded-full bg-emerald-500/4 blur-[100px] pointer-events-none" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Sessions</h2>
          <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
            {activeSessions.length > 0 ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                <span className="text-emerald-400 font-semibold">{activeSessions.length} running</span>
                <span className="text-gray-400">· {pausedSessions.length} paused · {sessions.length} total</span>
              </span>
            ) : (
              `No active sessions · ${sessions.length} total`
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(true); setEditingSessionId(null); setForm(initForm); setError(''); }}
          className="flex flex-shrink-0 whitespace-nowrap items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 hover:scale-105 transition-all"
        >
          <Plus size={16} /> New Session
        </button>
      </div>

      {showForm && (
        <SessionGlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white text-sm">{editingSessionId ? 'Edit Session' : 'Create New Session'}</h3>
            <button type="button" onClick={() => { setShowForm(false); setEditingSessionId(null); }} className="text-gray-400 hover:text-gray-200"><X size={16} /></button>
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-xl mb-4">{error}</div>}
          <form onSubmit={handleCreateOrUpdate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Session Title *</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Sprint Planning Session"
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description…" rows={2}
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="flex flex-shrink-0 whitespace-nowrap items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />} {editingSessionId ? 'Save Changes' : 'Create Session'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingSessionId(null); }} className="px-4 py-2 text-sm text-gray-300 border border-white/10 rounded-xl hover:bg-white/5">Cancel</button>
            </div>
          </form>
        </SessionGlassCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-1 space-y-3">
          {isLoading && !data ? (
            <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <SessionGlassCard className="p-10 text-center">
              <Clock size={28} className="mx-auto text-gray-500 mb-2" />
              <p className="text-gray-400 text-sm">No sessions in this workspace yet</p>
            </SessionGlassCard>
          ) : (
            <>
              {activeSessions.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> Running Now
                  </p>
                  {activeSessions.map((s) => (
                    <SessionCard key={s.id} s={s} allMembers={allMembers} sessionMemberMap={sessionMemberMap}
                      selected={selectedSession?.id === s.id} onSelect={() => selectSession(s)} onToggle={() => void toggleSession(s)} toggling={togglingId === s.id} />
                  ))}
                </>
              )}
              {pausedSessions.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" /> Paused
                  </p>
                  {pausedSessions.map((s) => (
                    <SessionCard key={s.id} s={s} allMembers={allMembers} sessionMemberMap={sessionMemberMap}
                      selected={selectedSession?.id === s.id} onSelect={() => selectSession(s)} onToggle={() => void toggleSession(s)} toggling={togglingId === s.id} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {activeSessions.length > 0 && (
            <SessionGlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0"><Layers size={14} className="text-emerald-400" /></div>
                <div><h3 className="font-bold text-white text-sm">Live Session Data</h3><p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">Showing data from {activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''} only</p></div>
                <div className="ml-auto flex items-center gap-1.5 flex-shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-xs text-emerald-400 font-semibold">Live</span></div>
              </div>
              <div className="space-y-3">
                {activeSessions.map((s) => (
                  <ActiveSessionFeed key={s.id} session={s} allMembers={allMembers} memberIds={sessionMemberMap[s.id] ?? []} logs={logsMap[s.id] ?? []} />
                ))}
              </div>
            </SessionGlassCard>
          )}

          {activeSessions.length === 0 && !selectedSession && (
            <SessionGlassCard className="flex items-center justify-center" style={{ minHeight: '200px' }}>
              <div className="text-center text-gray-400 p-10"><Radio size={28} className="mx-auto mb-3 opacity-25" /><p className="text-sm font-medium text-gray-300">No sessions running</p><p className="text-xs mt-1">Select or create a session</p></div>
            </SessionGlassCard>
          )}

          {selectedSession && (
            <>
              <SessionGlassCard className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-white text-base">{selectedSession.title}</h3>
                      {selectedSession.status === 'active'
                        ? <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE</span>
                        : selectedSession.status === 'completed'
                        ? <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} /> COMPLETED</span>
                        : <span className="whitespace-nowrap text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">PAUSED</span>}
                    </div>
                    {selectedSession.description && <p className="text-sm text-gray-400 mt-1">{selectedSession.description}</p>}
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400 tabular-nums">
                      <span className="flex items-center gap-1"><Clock size={11} />Started: {new Date(selectedSession.started_at).toLocaleString()}</span>
                      <span className="font-semibold text-blue-400">
                        Duration: {selectedSession.status === 'active' ? <LiveDuration start={selectedSession.started_at} /> : formatDuration(selectedSession.started_at, selectedSession.ended_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void handleShareJoinLink(selectedSession)} disabled={sharingInvite}
                      className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 font-semibold disabled:opacity-50">
                      {copiedJoin ? <Check size={12} /> : <Share2 size={12} />}
                      {copiedJoin ? 'Copied Join Link!' : 'Share Join Link'}
                    </button>
                    {sessionJoinCode && (
                      <button
                        type="button"
                        onClick={() => navigate?.('join', { inviteCode: sessionJoinCode })}
                        className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1 text-[11px] font-mono px-2.5 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                      >
                        /join/{sessionJoinCode} <ExternalLink size={10} />
                      </button>
                    )}
                    <button type="button" onClick={() => setBriefVisibleFor((prev) => ({ ...prev, [selectedSession.id]: !prev[selectedSession.id] }))}
                      className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25 font-semibold">
                      <Sparkles size={12} /> {briefVisibleFor[selectedSession.id] ? 'Hide AI Brief' : 'Generate AI Brief'}
                    </button>
                    <button type="button" onClick={() => { setForm({ title: selectedSession.title, description: selectedSession.description ?? '' }); setEditingSessionId(selectedSession.id); setShowForm(true); }}
                      className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 font-medium">
                      <Pencil size={12} /> Edit
                    </button>
                    {selectedSession.status !== 'completed' && (
                      <button type="button" onClick={() => void completeSession(selectedSession)} disabled={togglingId === selectedSession.id}
                        className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 font-semibold disabled:opacity-50">
                        <CheckCircle2 size={12} /> End Session
                      </button>
                    )}
                    <button type="button" onClick={() => void deleteSession(selectedSession)} disabled={deletingId === selectedSession.id}
                      className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20 font-medium disabled:opacity-50">
                      {deletingId === selectedSession.id ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                    </button>
                  </div>
                </div>
              </SessionGlassCard>

              <SessionGlassCard className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div><h4 className="font-bold text-white text-sm flex items-center gap-2"><Users size={14} className="text-blue-400" />Working on this session</h4><p className="text-xs text-gray-400 mt-0.5 tabular-nums">{assignedMembers.length} member{assignedMembers.length !== 1 ? 's' : ''} assigned</p></div>
                  <button type="button" onClick={() => setShowAssign((p) => !p)} className="flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 font-semibold">
                    <UserPlus size={12} /> {showAssign ? 'Done' : 'Assign'}
                  </button>
                </div>
                {assignedMembers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {assignedMembers.map((m) => (
                      <div key={m.id} className="flex items-center gap-2.5 bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 group">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: MEMBER_COLORS[allMembers.indexOf(m) % MEMBER_COLORS.length] }}>{m.name.charAt(0)}</div>
                        <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-200 truncate">{m.name}</p><p className="text-[10px] text-gray-400">{m.role}</p></div>
                        <button type="button" onClick={() => void toggleMember(m.id)} disabled={assigningId === m.id} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400">
                          {assigningId === m.id ? <Loader size={12} className="animate-spin" /> : <UserMinus size={12} />}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5"><Users size={12} className="opacity-40" />No members assigned — click Assign.</p>
                )}
                {showAssign && (
                  <div className="border-t border-white/5 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {allMembers.map((m) => {
                        const isAssigned = assignedMemberIds.includes(m.id);
                        return (
                          <button key={m.id} type="button" onClick={() => void toggleMember(m.id)} disabled={assigningId === m.id}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${isAssigned ? 'bg-blue-500/10 border-blue-500/25' : 'bg-white/[0.02] border-white/8'}`}>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: MEMBER_COLORS[allMembers.indexOf(m) % MEMBER_COLORS.length] }}>{m.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-200 truncate">{m.name}</p><p className="text-[10px] text-gray-400">{m.role}</p></div>
                            {isAssigned && <Check size={12} className="text-blue-400 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </SessionGlassCard>

              {briefVisibleFor[selectedSession.id] && (
                <SessionBriefCard workspaceId={workspaceId} session={selectedSession} logs={selectedLogs} assignedMembers={assignedMembers} />
              )}

              <SessionTimeline logs={selectedLogs} members={allMembers} />

              <SessionGlassCard>
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Activity size={14} className="text-cyan-400" /> Full Activity Log
                    <span className="text-[10px] font-normal text-gray-400 tabular-nums">({selectedLogs.length} entries)</span>
                  </h4>
                </div>
                <div className="p-5 overflow-y-auto max-h-80 space-y-2.5">
                  {selectedLogs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400"><Activity size={22} className="mx-auto mb-2 opacity-20" /><p className="text-sm">No activity logged yet</p></div>
                  ) : (
                    selectedLogs.map((log) => {
                      const lc = log.contribution_level === 'HIGH' ? '#10B981' : log.contribution_level === 'MEDIUM' ? '#F59E0B' : '#EF4444';
                      return (
                        <div key={log.id} className="bg-white/[0.025] border border-white/8 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-200">{(log.members as { name: string } | null)?.name ?? log.device_id}</p>
                            <span className="text-[10px] text-gray-400 font-mono tabular-nums">{new Date(log.created_at).toLocaleTimeString()}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                            <span className={log.voice ? 'text-blue-400' : 'text-gray-400'}>Voice: {log.voice ? 'Active' : 'Silent'}</span>
                            <span className={log.face ? 'text-emerald-400' : 'text-gray-400'}>Present: {log.face ? 'Yes' : 'No'}</span>
                            {log.face_expression && <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-gray-300">{log.face_expression}</span>}
                            {log.voice_quality && log.voice === 1 && <span className="px-1.5 py-0.5 rounded border border-cyan-500/25 bg-cyan-500/10 font-mono text-[10px] text-cyan-300">{log.voice_quality}</span>}
                            <span className="font-bold ml-auto tabular-nums" style={{ color: lc }}>{log.engagement_score ?? log.contribution_pct}% — {log.contribution_level}</span>
                          </div>
                          {log.transcript && <p className="mt-1.5 text-[11px] italic text-gray-300 border-t border-white/5 pt-1.5">&ldquo;{log.transcript}&rdquo;</p>}
                        </div>
                      );
                    })
                  )}
                </div>
              </SessionGlassCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
