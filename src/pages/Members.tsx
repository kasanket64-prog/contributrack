import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, Trash2, CreditCard as Edit2, X, Check, Loader, Search, Cpu,
  Clock, Activity, Camera, Mic, CheckCircle2, AlertCircle, ChevronUp, QrCode, FileSpreadsheet,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MEMBER_COLORS, deriveLabel } from '../lib/dashboardMetrics';
import { useAppSettings, useMembersQuery, useWorkspaceId } from '../hooks/useWorkspaceQueries';
import {
  BiometricPanel,
  BioPill,
  DeviceSecretField,
  SignedBioImage,
} from '../components/members/BiometricPanel';
import InviteAndImportModal from '../components/members/InviteAndImportModal';
import type { RouteParams } from '../lib/router';
import type { Member, Page } from '../lib/types';

const ROLES = ['member', 'leader', 'facilitator', 'observer'];
const initForm = { name: '', email: '', role: 'member', device_id: '', voice_label: '', face_label: '' };

const roleColors: Record<string, string> = {
  leader: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  member: 'text-gray-300 bg-white/5 border-white/10',
  facilitator: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  observer: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

const statusColors: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  completed: 'text-gray-400 bg-white/5 border-white/10',
  paused: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

export default function Members({
  navigate,
}: {
  navigate?: (page: Page, params?: RouteParams) => void;
}) {
  const qc = useQueryClient();
  const appSettings = useAppSettings();
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useMembersQuery(workspaceId);

  const members = data?.members ?? [];
  const memberSessions = data?.memberSessions ?? {};

  const [showForm, setShowForm] = useState(false);
  const [inviteModalTab, setInviteModalTab] = useState<'invite' | 'csv' | null>(null);
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refreshMembers = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['members', workspaceId] }),
      qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] }),
      qc.invalidateQueries({ queryKey: ['workspace-meta', workspaceId] }),
    ]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setSaving(true);
    try {
      const autoLabel = deriveLabel(form.name);
      if (editId) {
        const { error: err } = await supabase
          .from('members')
          .update({
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role,
            device_id: form.device_id.trim() || null,
            voice_label: form.voice_label.trim() || null,
            face_label: form.face_label.trim() || null,
          })
          .eq('id', editId);
        if (err) throw err;
      } else {
        const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length];
        const { error: err } = await supabase.from('members').insert({
          workspace_id: workspaceId,
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          device_id: form.device_id.trim() || null,
          avatar_color: color,
          voice_label: form.voice_label.trim() || autoLabel,
          face_label: form.face_label.trim() || autoLabel,
        });
        if (err) throw err;
      }
      setForm(initForm);
      setShowForm(false);
      setEditId(null);
      await refreshMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save member.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (m: Member) => {
    setForm({
      name: m.name,
      email: m.email,
      role: m.role,
      device_id: m.device_id ?? '',
      voice_label: m.voice_label ?? '',
      face_label: m.face_label ?? '',
    });
    setEditId(m.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this member from the workspace?')) return;
    setDeletingId(id);
    await supabase.from('members').delete().eq('id', id);
    await refreshMembers();
    setDeletingId(null);
    if (expandedId === id) setExpandedId(null);
  };

  const filtered = members.filter(
    (m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()),
  );

  const complete = members.filter((m) => m.face_image_url && m.voice_sample_url).length;
  const partial = members.filter((m) => (m.face_image_url || m.voice_sample_url) && !(m.face_image_url && m.voice_sample_url)).length;
  const none = members.length - complete - partial;

  return (
    <div className="relative p-6 space-y-5 min-h-full overflow-hidden">
      <div className="fixed top-20 left-64 w-96 h-96 rounded-full bg-blue-600/5 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-10 right-20 w-80 h-80 rounded-full bg-emerald-500/4 blur-[100px] pointer-events-none" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Team Members</h2>
          <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
            {members.length} registered · {complete} fully profiled · {partial} partial · {none} missing biometrics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInviteModalTab('invite')}
            className="flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 transition-all"
          >
            <QrCode size={14} /> Invite Link &amp; QR
          </button>
          <button
            type="button"
            onClick={() => setInviteModalTab('csv')}
            className="flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20 transition-all"
          >
            <FileSpreadsheet size={14} /> Bulk CSV Import
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(true); setEditId(null); setForm(initForm); setError(''); }}
            className="flex flex-shrink-0 whitespace-nowrap items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-105 transition-all duration-200"
          >
            <UserPlus size={16} /> Add Member
          </button>
        </div>
      </div>

      {members.length > 0 && none > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0" />
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-300">{none} member{none !== 1 ? 's' : ''} missing AI recognition profile</p>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Expand a member card and capture their face and voice so the AI can identify them during sessions.
              </p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="relative bg-white/[0.025] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white text-sm">{editId ? 'Edit Member' : 'Register New Member'}</h3>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setError(''); }} className="text-gray-400 hover:text-gray-200">
              <X size={16} />
            </button>
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-xl mb-4">{error}</div>}
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Alice Johnson"
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Address *</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="alice@example.com"
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Role</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50">
                {ROLES.map((r) => <option key={r} value={r} className="bg-[#0D1626]">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1"><Cpu size={10} />IoT Device ID</label>
              <input value={form.device_id} onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))} placeholder="e.g. device_1"
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
            </div>
            {editId && (
              <DeviceSecretField memberId={editId} secret={members.find((m) => m.id === editId)?.device_secret ?? null} onRegenerated={() => void refreshMembers()} />
            )}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1"><Camera size={10} />Face Label (AI)</label>
              <input value={form.face_label} onChange={(e) => setForm((f) => ({ ...f, face_label: e.target.value }))} placeholder={form.name ? deriveLabel(form.name) : 'auto-generated'}
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-blue-300 placeholder-gray-500 rounded-xl font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1"><Mic size={10} />Voice Label (AI)</label>
              <input value={form.voice_label} onChange={(e) => setForm((f) => ({ ...f, voice_label: e.target.value }))} placeholder={form.name ? deriveLabel(form.name) : 'auto-generated'}
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-emerald-300 placeholder-gray-500 rounded-xl font-mono" />
            </div>
            <div className="md:col-span-2 flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />} {editId ? 'Save Changes' : 'Register Member'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); setError(''); }}
                className="px-4 py-2 text-sm text-gray-300 border border-white/10 rounded-xl hover:bg-white/5">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…"
          className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
      </div>

      {isLoading && !data ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/[0.025] border border-white/8 rounded-2xl p-14 text-center">
          <UserPlus size={32} className="mx-auto text-gray-500 mb-3" />
          <p className="text-gray-300 font-medium text-sm">No members in this workspace yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {filtered.map((m) => {
            const color = MEMBER_COLORS[members.indexOf(m) % MEMBER_COLORS.length];
            const sessions = memberSessions[m.id] ?? [];
            const activeSessions = sessions.filter((s) => s.status === 'active');
            const hasFace = !!m.face_image_url;
            const hasVoice = !!m.voice_sample_url;
            const isExpanded = expandedId === m.id;

            return (
              <div key={m.id} className="relative bg-white/[0.025] border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 hover:bg-white/[0.035] transition-all duration-300 p-5">
                <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundImage: `linear-gradient(to right, transparent, ${color}60, transparent)` }} />
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      {hasFace ? (
                        <SignedBioImage path={m.face_image_url} alt={m.name} className="w-10 h-10 rounded-xl object-cover border-2" style={{ borderColor: color + '60' }} />
                      ) : (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: color }}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {activeSessions.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0B1120] animate-pulse" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-100 text-sm truncate">{m.name}</p>
                      <p className="text-xs text-gray-400 truncate">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button type="button" onClick={() => handleEdit(m)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg" aria-label={`Edit ${m.name}`}><Edit2 size={13} /></button>
                    <button type="button" onClick={() => void handleDelete(m.id)} disabled={deletingId === m.id} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg" aria-label={`Delete ${m.name}`}>
                      {deletingId === m.id ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${roleColors[m.role] ?? 'text-gray-300 bg-white/5 border-white/10'}`}>{m.role}</span>
                  {m.device_id && <span className="text-[10px] text-gray-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-mono flex items-center gap-1 whitespace-nowrap"><Cpu size={9} />{m.device_id}</span>}
                  <BioPill ok={hasFace} label={hasFace ? 'Face' : 'No Face'} />
                  <BioPill ok={hasVoice} label={hasVoice ? 'Voice' : 'No Voice'} />
                </div>

                {sessions.length > 0 && (
                  <div className="border-t border-white/5 pt-3 mb-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Clock size={9} />Sessions</p>
                    <div className="space-y-1">
                      {sessions.slice(0, 2).map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap ${statusColors[s.status]}`}>
                            {s.status === 'active' ? '● live' : s.status}
                          </span>
                          <span className="text-[11px] text-gray-300 truncate">{s.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-gray-400 tabular-nums">Joined {new Date(m.created_at).toLocaleDateString()}</p>
                  {activeSessions.length > 0 && <span className="flex flex-shrink-0 whitespace-nowrap items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Activity size={9} /> Active now</span>}
                </div>

                <button type="button" onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className={`mt-3 w-full flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-semibold py-2 rounded-xl border transition-all duration-200 ${isExpanded ? 'bg-white/5 border-white/10 text-gray-300' : !hasFace || !hasVoice ? 'bg-amber-500/8 border-amber-500/20 text-amber-400 hover:bg-amber-500/15' : 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'}`}>
                  {isExpanded ? <><ChevronUp size={12} /> Hide AI Profile</> : !hasFace || !hasVoice ? <><AlertCircle size={12} /> Setup AI Recognition</> : <><CheckCircle2 size={12} /> View AI Profile</>}
                </button>

                {isExpanded && <BiometricPanel member={m} onUpdated={() => void refreshMembers()} />}
              </div>
            );
          })}
        </div>
      )}

      <InviteAndImportModal
        open={inviteModalTab !== null}
        initialTab={inviteModalTab ?? 'invite'}
        onClose={() => setInviteModalTab(null)}
        workspaceId={workspaceId}
        workspaceName={appSettings.projectName}
        members={members}
        navigate={navigate}
      />
    </div>
  );
}
