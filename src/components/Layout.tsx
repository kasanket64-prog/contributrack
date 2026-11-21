import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  Settings,
  Cpu,
  Bell,
  Search,
  LogOut,
  Activity,
  Menu,
  X,
  Sparkles,
  Command,
  ShieldCheck,
  UserCheck,
  Download,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Page } from '../lib/types';
import { supabase, IS_DEMO_MODE, triggerContributionAnalysis } from '../lib/supabase';
import AiCopilotDrawer from './AiCopilotDrawer';
import InstallAppModal from './InstallAppModal';
import { usePwaInstall } from '../hooks/usePwaInstall';
import {
  loadSettings,
  saveSettings,
  SETTINGS_EVENT,
  WORKSPACE_IDS,
  WORKSPACE_OPTIONS,
  type AppSettings,
  type ViewMode,
  type WorkspaceOption,
} from '../lib/settings';

interface LayoutProps {
  currentPage: Page;
  navigate: (page: Page) => void;
  children: React.ReactNode;
  userEmail?: string;
}

interface SearchEntry {
  id: string;
  label: string;
  sub: string;
  page: Page;
  tag: string;
}

interface LiveNotif {
  id: string;
  text: string;
  time: string;
  color: string;
  page: Page;
}

const navItems: {
  id: Page;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'sessions', label: 'Sessions', icon: Clock },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'iot', label: 'IoT Devices', icon: Cpu },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const PAGE_TITLES: Record<Page, string> = {
  landing: 'Home',
  login: 'Login',
  dashboard: 'Dashboard',
  members: 'Team Members',
  sessions: 'Sessions',
  documents: 'Documents',
  settings: 'Settings',
  iot: 'IoT Devices',
  verify: 'Verify Credential',
  join: 'Join Workspace',
};

const PAGE_SUBTITLES: Record<Page, string> = {
  landing: '',
  login: '',
  dashboard: 'Real-time contribution intelligence',
  members: 'Manage your team roster',
  sessions: 'Track and review team sessions',
  documents: 'Written contribution analysis',
  settings: 'Configure your workspace',
  iot: 'Connected sensor devices',
  verify: 'Verify tamper-evident contribution proof',
  join: 'Join a project team or session via invite code',
};

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function Layout({
  currentPage,
  navigate,
  children,
  userEmail,
}: LayoutProps) {
  const qc = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState<SearchEntry[]>([]);
  const [notifs, setNotifs] = useState<LiveNotif[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadSettings());

  const { canNativeInstall, isInstalled, platform, promptInstall } = usePwaInstall();

  const handleInstallApp = async () => {
    const outcome = await promptInstall();
    if (outcome === 'manual') {
      setInstallModalOpen(true);
    }
  };

  const notifRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'U';

  useEffect(() => {
    const onSettings = () => setAppSettings(loadSettings());
    window.addEventListener(SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(SETTINGS_EVENT, onSettings);
  }, []);

  const refreshTopbarData = useCallback(async () => {
    const currentSettings = loadSettings();
    const wsId = currentSettings.activeWorkspaceId;
    const [mRes, sRes, dRes, iRes] = await Promise.all([
      supabase.from('members').select('id, name, role, email, created_at').eq('workspace_id', wsId).order('created_at', { ascending: false }),
      supabase.from('sessions').select('id, title, status, created_at').eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(20),
      supabase.from('documents').select('id, name, word_count, created_at').eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(20),
      supabase.from('iot_data').select('id, device_id, contribution_level, face_expression, created_at, members(name)').eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(15),
    ]);

    const memberRows = mRes.data ?? [];
    setWorkspaceMembers(memberRows.map((m) => ({ id: m.id, name: m.name, role: m.role })));

    const entries: SearchEntry[] = [];
    for (const m of mRes.data ?? []) {
      entries.push({
        id: `m-${m.id}`,
        label: m.name,
        sub: `${m.role} · ${m.email}`,
        page: 'members',
        tag: 'Member',
      });
    }
    for (const s of sRes.data ?? []) {
      entries.push({
        id: `s-${s.id}`,
        label: s.title,
        sub: `Status: ${s.status}`,
        page: 'sessions',
        tag: 'Session',
      });
    }
    for (const d of dRes.data ?? []) {
      entries.push({
        id: `d-${d.id}`,
        label: d.name,
        sub: `${Number(d.word_count ?? 0).toLocaleString()} words`,
        page: 'documents',
        tag: 'Doc',
      });
    }
    setSearchIndex(entries);

    const liveNotifs: LiveNotif[] = [];
    for (const r of iRes.data ?? []) {
      const mName = (r.members as { name?: string } | null)?.name ?? r.device_id;
      const isAlert =
        r.face_expression === 'DROWSY' ||
        r.face_expression === 'DISTRACTED' ||
        r.contribution_level === 'LOW';

      if (isAlert && currentSettings.notifyLowContribution) {
        liveNotifs.push({
          id: `iot-${r.id}`,
          text: `${mName}: ${r.face_expression ?? r.contribution_level} reading detected`,
          time: formatRelativeTime(r.created_at),
          color: r.face_expression === 'DROWSY' ? 'bg-rose-500' : 'bg-amber-500',
          page: 'dashboard',
        });
      } else if (r.contribution_level === 'HIGH' && liveNotifs.length < 4) {
        liveNotifs.push({
          id: `iot-${r.id}`,
          text: `${mName} logged HIGH contribution (${r.face_expression ?? 'ACTIVE'})`,
          time: formatRelativeTime(r.created_at),
          color: 'bg-emerald-500',
          page: 'dashboard',
        });
      }
      if (liveNotifs.length >= 4) break;
    }

    if (currentSettings.notifySessionEnd) {
      for (const s of sRes.data ?? []) {
        if (s.status !== 'active') {
          liveNotifs.push({
            id: `sess-${s.id}`,
            text: `Session "${s.title}" is ${s.status}`,
            time: formatRelativeTime(s.created_at),
            color: 'bg-cyan-500',
            page: 'sessions',
          });
          break;
        }
      }
    }

    if (currentSettings.notifyNewMember && (mRes.data ?? []).length > 0) {
      const latestMember = mRes.data![0];
      liveNotifs.push({
        id: `mem-${latestMember.id}`,
        text: `Member registered: ${latestMember.name}`,
        time: formatRelativeTime(latestMember.created_at),
        color: 'bg-indigo-500',
        page: 'members',
      });
    }

    setNotifs(liveNotifs.slice(0, 6));
  }, []);

  useEffect(() => {
    void refreshTopbarData();
  }, [refreshTopbarData, currentPage, appSettings.activeWorkspaceId]);

  useEffect(() => {
    if (
      appSettings.viewMode === 'member' &&
      (currentPage === 'members' || currentPage === 'settings')
    ) {
      navigate('dashboard');
    }
  }, [appSettings.viewMode, currentPage, navigate]);

  const resolvedActingMemberId = useMemo(() => {
    if (workspaceMembers.some((m) => m.id === appSettings.actingMemberId)) {
      return appSettings.actingMemberId;
    }
    return workspaceMembers[0]?.id ?? '';
  }, [workspaceMembers, appSettings.actingMemberId]);

  const actingMember = useMemo(
    () => workspaceMembers.find((m) => m.id === resolvedActingMemberId) ?? null,
    [workspaceMembers, resolvedActingMemberId],
  );

  const visibleNavItems = useMemo(() => {
    if (appSettings.viewMode === 'member') {
      return navItems.filter((item) => item.id !== 'members' && item.id !== 'settings');
    }
    return navItems;
  }, [appSettings.viewMode]);

  const setViewPerspective = (mode: ViewMode, memberIdOverride?: string) => {
    const nextMemberId =
      mode === 'member'
        ? (memberIdOverride ?? (resolvedActingMemberId || workspaceMembers[0]?.id || ''))
        : appSettings.actingMemberId;
    const updated = saveSettings({
      ...appSettings,
      viewMode: mode,
      actingMemberId: nextMemberId,
    });
    setAppSettings(updated);
    if (mode === 'member' && (currentPage === 'members' || currentPage === 'settings')) {
      navigate('dashboard');
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCmdOpen((prev) => !prev);
        void refreshTopbarData();
        return;
      }
      if (event.key === 'Escape') {
        setNotifOpen(false);
        setSearchOpen(false);
        setCmdOpen(false);
        setCopilotOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [refreshTopbarData]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return searchIndex.slice(0, 6);
    return searchIndex
      .filter((e) => e.label.toLowerCase().includes(q) || e.sub.toLowerCase().includes(q) || e.tag.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchIndex, searchQuery]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090B] font-sans text-zinc-100">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 md:relative flex flex-shrink-0 flex-col border-r border-white/[0.06] bg-[#0C0C0F] transition-all duration-300 ${
          sidebarOpen
            ? 'w-60 translate-x-0'
            : 'w-60 -translate-x-full md:w-16 md:translate-x-0'
        }`}
      >
        {/* Unified Brand + Workspace Switcher */}
        <div className="border-b border-white/[0.06] px-3.5 py-3.5 space-y-3">
          <div className={`flex items-center gap-2.5 ${!sidebarOpen ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-zinc-950 shadow-sm">
                <Activity size={16} />
              </div>
              {sidebarOpen && (
                <p className="truncate text-sm font-semibold tracking-tight text-white">ContribuTrack</p>
              )}
            </div>
            {sidebarOpen && (
              <span className="flex-shrink-0 rounded-md border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-zinc-400">
                {appSettings.planTier}
              </span>
            )}
          </div>

          {sidebarOpen && (
            <select
              value={appSettings.activeWorkspace}
              aria-label="Switch active workspace"
              onChange={(e) => {
                const nextWs = e.target.value as WorkspaceOption;
                const updated = saveSettings({
                  ...appSettings,
                  activeWorkspace: nextWs,
                  activeWorkspaceId: WORKSPACE_IDS[nextWs],
                  projectName: nextWs,
                });
                setAppSettings(updated);
                void qc.invalidateQueries();
                void refreshTopbarData();
              }}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-200 focus:border-white/25 focus:outline-none [&>option]:bg-[#111114]"
            >
              {WORKSPACE_OPTIONS.map((ws) => (
                <option key={ws} value={ws}>
                  {ws}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-4">
          {visibleNavItems.map(({ id, label, icon: Icon }) => {
            const active = currentPage === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  navigate(id);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                title={!sidebarOpen ? label : undefined}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150 ${
                  active
                    ? 'bg-white/[0.08] font-medium text-white'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
                } ${!sidebarOpen ? 'justify-center' : ''}`}
              >
                <Icon
                  size={16}
                  className={`flex-shrink-0 ${
                    active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
                  }`}
                />

                {sidebarOpen && <span className="flex-1 text-left whitespace-nowrap truncate">{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Role Perspective & User */}
        <div className="border-t border-white/[0.06] p-3 space-y-2.5">
          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallApp}
              title="Install ContribuTrack as a desktop or mobile app"
              className={`flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-indigo-400/35 hover:bg-indigo-500/[0.08] hover:text-white ${
                !sidebarOpen ? 'justify-center px-1.5' : ''
              }`}
            >
              <Download size={13} className="flex-shrink-0 text-indigo-400" />
              {sidebarOpen && <span className="truncate">Install App</span>}
            </button>
          )}
          {sidebarOpen && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-white/[0.04] p-0.5 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setViewPerspective('admin')}
                  className={`flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    appSettings.viewMode === 'admin'
                      ? 'bg-white/[0.1] text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <ShieldCheck size={11} />
                  Instructor
                </button>
                <button
                  type="button"
                  onClick={() => setViewPerspective('member')}
                  className={`flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    appSettings.viewMode === 'member'
                      ? 'bg-white/[0.1] text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <UserCheck size={11} />
                  Member
                </button>
              </div>
              {appSettings.viewMode === 'member' && workspaceMembers.length > 0 && (
                <select
                  aria-label="Acting as workspace member"
                  value={resolvedActingMemberId}
                  onChange={(e) => setViewPerspective('member', e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[11px] font-medium text-zinc-200 focus:outline-none [&>option]:bg-[#111114]"
                >
                  {workspaceMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      Acting as: {m.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className={`flex items-center gap-2.5 ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-zinc-800 text-xs font-semibold text-zinc-100">
              {appSettings.viewMode === 'member' && actingMember
                ? actingMember.name.slice(0, 2).toUpperCase()
                : initials}
            </div>

            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-zinc-200">
                  {appSettings.viewMode === 'member' && actingMember
                    ? actingMember.name
                    : userEmail ?? 'Guest'}
                </p>
                <p className="text-[10px] text-zinc-500">
                  {appSettings.viewMode === 'member' ? 'Member Self-View' : 'Administrator'}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="relative z-30 flex h-14 flex-shrink-0 items-center justify-between gap-2 sm:gap-3 border-b border-white/[0.06] bg-[#09090B]/85 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((p) => !p)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
              <span className="hidden xl:inline max-w-[160px] truncate text-xs font-medium text-zinc-400">
                {appSettings.projectName}
              </span>
              <span className="hidden xl:inline text-zinc-700">/</span>
              <h1 className="truncate text-sm font-semibold leading-tight text-white">
                {PAGE_TITLES[currentPage]}
              </h1>
              {PAGE_SUBTITLES[currentPage] && (
                <span className="hidden 2xl:inline truncate text-xs text-zinc-500 pl-1">
                  — {PAGE_SUBTITLES[currentPage]}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
            {appSettings.viewMode === 'member' && (
              <button
                type="button"
                onClick={() => setViewPerspective('admin')}
                title="Currently previewing Member Self-View — click to return to Instructor view"
                className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-[11px] font-medium text-indigo-200 hover:bg-indigo-500/25"
              >
                <UserCheck size={12} />
                <span className="hidden xl:inline">Member ·</span> Switch to Instructor
              </button>
            )}

            {/* Quiet Neutral Ask AI Copilot */}
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2.5 sm:px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08]"
            >
              <Sparkles size={13} className="flex-shrink-0 text-indigo-400" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            {IS_DEMO_MODE && appSettings.viewMode !== 'member' && (
              <button
                type="button"
                onClick={() => navigate('settings')}
                title="Local demo mode — manage demo data in Settings"
                className="hidden lg:inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
              >
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                Demo
              </button>
            )}

            {/* Global Search + Ctrl+K trigger */}
            <div className="relative hidden sm:block flex-shrink-0" ref={searchRef}>
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                value={searchQuery}
                onFocus={() => {
                  setSearchOpen(true);
                  void refreshTopbarData();
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                className="w-32 lg:w-36 xl:w-44 rounded-lg border border-white/[0.08] bg-white/[0.04] py-1.5 pl-8 pr-10 text-xs text-zinc-200 placeholder-zinc-500 transition-all focus:w-48 xl:focus:w-56 focus:border-white/20 focus:outline-none"
                placeholder="Search…"
              />
              <button
                type="button"
                onClick={() => {
                  setCmdOpen(true);
                  setSearchOpen(false);
                  void refreshTopbarData();
                }}
                title="Open Command Palette (Ctrl+K)"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 rounded border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-zinc-400 hover:text-zinc-200"
              >
                <Command size={9} />K
              </button>

              {searchOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/15 bg-[#070E1F]/95 backdrop-blur-2xl shadow-2xl shadow-black/80">
                  <div className="border-b border-white/[0.06] px-3.5 py-2.5">
                    <p className="text-[11px] font-semibold text-gray-400">
                      {searchQuery.trim() ? `Matches (${searchResults.length})` : 'Quick Jump'}
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-1.5">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-gray-500">
                        No matches for &ldquo;{searchQuery}&rdquo;
                      </p>
                    ) : (
                      searchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            navigate(item.page);
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-gray-100">{item.label}</p>
                            <p className="truncate text-[10px] text-gray-400">{item.sub}</p>
                          </div>
                          <span className="flex-shrink-0 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-300">
                            {item.tag}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="relative flex-shrink-0" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next) void refreshTopbarData();
                }}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-white/5 hover:text-white"
                aria-label="Toggle notifications"
              >
                <Bell size={16} />
                {notifs.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400 ring-2 ring-[#060B18]" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-white/15 bg-[#070E1F]/95 backdrop-blur-2xl shadow-2xl shadow-black/80">
                  <div className="border-b border-white/[0.06] px-4 py-3">
                    <p className="text-sm font-semibold text-white">Live Alerts</p>
                    <p className="text-xs text-gray-400">
                      {notifs.length} recent workspace event{notifs.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="max-h-72 overflow-y-auto p-2">
                    {notifs.length === 0 ? (
                      <p className="px-3 py-5 text-center text-xs text-gray-500">
                        No recent alerts matching your notification settings.
                      </p>
                    ) : (
                      notifs.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            navigate(n.page);
                            setNotifOpen(false);
                          }}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                        >
                          <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${n.color}`} />
                          <div>
                            <p className="text-xs leading-relaxed text-gray-200">{n.text}</p>
                            <p className="mt-0.5 text-[10px] text-gray-400">{n.time}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sign out */}
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('landing');
              }}
              className="flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-gray-400 transition-all hover:bg-white/5 hover:text-white"
            >
              <LogOut size={14} className="flex-shrink-0" />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>

        {/* Mobile Bottom Quick-Action Bar */}
        <nav
          aria-label="Mobile quick actions"
          className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-white/[0.08] bg-[#0C0C0F]/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden"
        >
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium ${
              currentPage === 'dashboard' ? 'text-white' : 'text-zinc-400'
            }`}
          >
            <LayoutDashboard size={15} />
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('sessions')}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium ${
              currentPage === 'sessions' ? 'text-white' : 'text-zinc-400'
            }`}
          >
            <Clock size={15} />
            Sessions
          </button>
          <button
            type="button"
            onClick={() => navigate('documents')}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium ${
              currentPage === 'documents' ? 'text-white' : 'text-zinc-400'
            }`}
          >
            <FileText size={15} />
            Docs
          </button>
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium text-indigo-300"
          >
            <Sparkles size={15} />
            Ask AI
          </button>
        </nav>
      </div>

      {/* Ask ContribuTrack AI Copilot Drawer */}
      <AiCopilotDrawer
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        navigate={navigate}
      />

      {/* Ctrl+K Command Palette */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-20 p-4 backdrop-blur-sm"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-[#070E1F]/95 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <Search size={15} className="text-cyan-400" />
              <input
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Type a command or search members, sessions, docs…"
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                ESC
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-3">
              <div>
                <p className="px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Quick Actions
                </p>
                {[
                  {
                    label: 'Ask ContribuTrack AI Copilot',
                    tag: 'AI',
                    run: () => {
                      setCmdOpen(false);
                      setCopilotOpen(true);
                    },
                  },
                  {
                    label: 'Recalculate AI Scores',
                    tag: 'Action',
                    run: () => {
                      setCmdOpen(false);
                      navigate('dashboard');
                      void triggerContributionAnalysis(undefined, appSettings.activeWorkspaceId);
                    },
                  },
                  { label: 'Open Dashboard', tag: 'Page', run: () => { setCmdOpen(false); navigate('dashboard'); } },
                  { label: 'Manage Team Members', tag: 'Page', run: () => { setCmdOpen(false); navigate('members'); } },
                  { label: 'Sessions & Multi-Track Timeline', tag: 'Page', run: () => { setCmdOpen(false); navigate('sessions'); } },
                  { label: 'Documents & GitHub Sync', tag: 'Page', run: () => { setCmdOpen(false); navigate('documents'); } },
                  { label: 'IoT Live Browser Sensor', tag: 'Page', run: () => { setCmdOpen(false); navigate('iot'); } },
                  ...(!isInstalled
                    ? [
                        {
                          label: 'Install ContribuTrack App',
                          tag: 'App',
                          run: () => {
                            setCmdOpen(false);
                            void handleInstallApp();
                          },
                        },
                      ]
                    : []),
                  {
                    label: 'Billing & Payment Links',
                    tag: 'Settings',
                    run: () => {
                      sessionStorage.setItem('contributrack-settings-section', 'Billing & Plans');
                      setCmdOpen(false);
                      navigate('settings');
                    },
                  },
                ]
                  .filter((a) => !cmdQuery.trim() || a.label.toLowerCase().includes(cmdQuery.toLowerCase()))
                  .map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={a.run}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/[0.06]"
                    >
                      <span className="font-medium">{a.label}</span>
                      <span className="rounded border border-indigo-400/25 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[9px] text-indigo-300">
                        {a.tag}
                      </span>
                    </button>
                  ))}
              </div>

              {searchIndex.filter(
                (item) =>
                  !cmdQuery.trim() ||
                  item.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
                  item.sub.toLowerCase().includes(cmdQuery.toLowerCase()),
              ).length > 0 && (
                <div>
                  <p className="px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Workspace Records
                  </p>
                  {searchIndex
                    .filter(
                      (item) =>
                        !cmdQuery.trim() ||
                        item.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
                        item.sub.toLowerCase().includes(cmdQuery.toLowerCase()),
                    )
                    .slice(0, 6)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          navigate(item.page);
                          setCmdOpen(false);
                          setCmdQuery('');
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-white/[0.06]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">{item.label}</p>
                          <p className="truncate text-[10px] text-gray-500">{item.sub}</p>
                        </div>
                        <span className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-300">
                          {item.tag}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <InstallAppModal
        open={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        canNativeInstall={canNativeInstall}
        platform={platform}
        onInstall={promptInstall}
      />
    </div>
  );
}
