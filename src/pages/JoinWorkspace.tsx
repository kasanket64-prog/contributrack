import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Loader,
  Mic,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { DEMO_EMAIL, DEMO_PASSWORD, IS_DEMO_MODE, supabase } from '../lib/supabase';
import {
  loadSettings,
  saveSettings,
  WORKSPACE_OPTIONS,
  type SensorPrivacyMode,
  type WorkspaceOption,
} from '../lib/settings';
import { deriveLabel, MEMBER_COLORS } from '../lib/dashboardMetrics';
import type { RouteParams } from '../lib/router';
import type { Page, Session, Workspace, WorkspaceInvite } from '../lib/types';

export default function JoinWorkspace({
  inviteCode: initialCode = '',
  navigate,
  onJoined,
}: {
  inviteCode?: string;
  navigate: (page: Page, params?: RouteParams) => void;
  onJoined?: (email: string) => void;
}) {
  const qc = useQueryClient();
  const [codeInput, setCodeInput] = useState(initialCode || 'CAPSTONE-A');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [invite, setInvite] = useState<WorkspaceInvite | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [privacyMode, setPrivacyMode] = useState<SensorPrivacyMode>('audio_docs_only');
  const [submitting, setSubmitting] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinedLiveConfirmation, setJoinedLiveConfirmation] = useState(false);

  const resolveCode = async (rawCode: string) => {
    const clean = rawCode.trim().toUpperCase();
    if (!clean) return;
    setLookupLoading(true);
    setLookupError('');
    try {
      const { data: inv, error: invErr } = await supabase
        .from('workspace_invites')
        .select('*')
        .eq('code', clean)
        .maybeSingle();
      if (invErr) throw invErr;
      if (!inv) {
        setInvite(null);
        setWorkspace(null);
        setSession(null);
        setLookupError(`Invite code "${clean}" was not found. Check with your instructor or team lead.`);
        return;
      }

      const typedInvite = inv as WorkspaceInvite;
      setInvite(typedInvite);
      setRole(typedInvite.role || 'member');

      const [wsRes, sessRes] = await Promise.all([
        supabase.from('workspaces').select('*').eq('id', typedInvite.workspace_id).maybeSingle(),
        typedInvite.session_id
          ? supabase.from('sessions').select('*').eq('id', typedInvite.session_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      setWorkspace((wsRes.data ?? null) as Workspace | null);
      setSession((sessRes.data ?? null) as Session | null);
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : 'Unable to resolve invite code.');
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    const target = initialCode || 'CAPSTONE-A';
    setCodeInput(target.toUpperCase());
    void resolveCode(target);
  }, [initialCode]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite || !workspace) return;
    setJoinError('');
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      setJoinError('Please enter both your full name and email address.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: existingMember } = await supabase
        .from('members')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('email', trimmedEmail)
        .maybeSingle();

      let memberId = existingMember?.id ?? '';

      if (!memberId) {
        const { count } = await supabase
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id);
        const color = MEMBER_COLORS[(count ?? 0) % MEMBER_COLORS.length];
        const autoLabel = deriveLabel(trimmedName);
        const slugSuffix = `${autoLabel.slice(0, 10)}_${Date.now().toString().slice(-4)}`;

        const { data: inserted, error: insErr } = await supabase
          .from('members')
          .insert({
            workspace_id: workspace.id,
            name: trimmedName,
            email: trimmedEmail,
            role,
            avatar_color: color,
            device_id: `web_${slugSuffix}`,
            voice_label: autoLabel,
            face_label: autoLabel,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;
        memberId = inserted.id;
      }

      if (invite.session_id && memberId) {
        await supabase
          .from('session_members')
          .upsert({ session_id: invite.session_id, member_id: memberId }, { onConflict: 'session_id,member_id' });
      }

      const currentSettings = loadSettings();
      const matchedWsName = WORKSPACE_OPTIONS.includes(workspace.name as WorkspaceOption)
        ? (workspace.name as WorkspaceOption)
        : currentSettings.activeWorkspace;

      saveSettings({
        ...currentSettings,
        activeWorkspace: matchedWsName,
        activeWorkspaceId: workspace.id,
        projectName: workspace.name,
        sensorPrivacyMode: privacyMode,
        viewMode: 'member',
        actingMemberId: memberId,
      });

      await qc.invalidateQueries();

      if (IS_DEMO_MODE) {
        await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
        onJoined?.(trimmedEmail || DEMO_EMAIL);
        navigate('dashboard');
      } else {
        const { data: sessData } = await supabase.auth.getSession();
        if (sessData.session?.user?.email) {
          onJoined?.(sessData.session.user.email);
          navigate('dashboard');
        } else {
          setJoinedLiveConfirmation(true);
        }
      }
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Could not join workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('landing')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={13} /> Back Home
          </button>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">
            <Sparkles size={11} /> Workspace Join Portal
          </span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#070E1F] p-6 shadow-2xl space-y-5">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <UserPlus size={18} className="text-cyan-400 flex-shrink-0" /> Join Your Team Workspace
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Enter an invite code shared by your instructor or teammate to join your project roster with privacy controls.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (codeInput.trim()) {
                navigate('join', { inviteCode: codeInput.trim().toUpperCase() });
                void resolveCode(codeInput);
              }
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Enter invite code (e.g. CAPSTONE-A)"
                className="w-full rounded-xl border border-white/15 bg-black/40 py-2.5 pl-9 pr-3 font-mono text-xs text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={lookupLoading || !codeInput.trim()}
              className="rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50 whitespace-nowrap"
            >
              {lookupLoading ? 'Checking…' : 'Lookup Code'}
            </button>
          </form>

          {lookupLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-cyan-300">
              <Loader size={15} className="animate-spin" /> Resolving invite code…
            </div>
          )}

          {!lookupLoading && lookupError && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] p-4 text-xs text-rose-200">
              {lookupError}
            </div>
          )}

          {!lookupLoading && joinedLiveConfirmation && workspace && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 size={18} /> Added to {workspace.name}
              </div>
              <p className="text-xs text-gray-300">
                Your profile and privacy preference have been saved. Sign in to view your Member Dashboard.
              </p>
              <button
                type="button"
                onClick={() => navigate('login')}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-bold text-white"
              >
                Continue to Sign In
              </button>
            </div>
          )}

          {!lookupLoading && invite && workspace && !joinedLiveConfirmation && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] p-4 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-cyan-400" />
                    <span className="text-sm font-black text-white">{workspace.name}</span>
                  </div>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-cyan-200">
                    {invite.code}
                  </span>
                </div>
                {session && (
                  <p className="text-xs text-emerald-300 font-medium">
                    Joining session: {session.title} ({session.status})
                  </p>
                )}
                <p className="text-[11px] text-gray-400">
                  Fairness model: <span className="uppercase text-gray-200 font-semibold">{workspace.fairness_method}</span> · Default role: <span className="text-gray-200 font-semibold">{role}</span>
                </p>
              </div>

              {joinError && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {joinError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Full Name *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Maya Deshmukh"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="maya@university.edu"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Team Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-2 text-sm text-gray-200 focus:border-cyan-400/50 focus:outline-none"
                >
                  {['member', 'leader', 'facilitator', 'observer'].map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-200">On-Device Privacy Guarantee</p>
                    <p className="text-[11px] text-gray-300 leading-relaxed mt-0.5">
                      Webcam frames never leave your browser. Choose your comfort level below — Audio + Docs mode gives full participation credit without turning on your camera.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrivacyMode('audio_docs_only')}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      privacyMode === 'audio_docs_only'
                        ? 'border-emerald-400/60 bg-emerald-500/15 text-white'
                        : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/20'
                    }`}
                  >
                    <Mic size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold">Audio + Docs Only</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">No camera stream required</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrivacyMode('camera_audio')}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      privacyMode === 'camera_audio'
                        ? 'border-cyan-400/60 bg-cyan-500/15 text-white'
                        : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/20'
                    }`}
                  >
                    <Video size={14} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold">Camera + Audio</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">On-device face expression + voice</p>
                    </div>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-95 disabled:opacity-50"
              >
                {submitting ? <Loader size={15} className="animate-spin" /> : <UserPlus size={15} />}
                {submitting ? 'Joining Workspace…' : `Join ${workspace.name} as Member`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
