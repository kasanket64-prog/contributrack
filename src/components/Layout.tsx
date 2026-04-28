import {
  LayoutDashboard, Users, Clock, FileText, Settings, Cpu,
  Bell, Search, LogOut, Activity, Menu, X, ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import type { Page } from '../lib/types';

interface LayoutProps {
  currentPage: Page;
  navigate: (page: Page) => void;
  children: React.ReactNode;
  userEmail?: string;
}

const navItems: { id: Page; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
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
};

const NOTIFS = [
  { text: 'Device 1 sent high contribution reading', time: '2m ago', color: 'bg-emerald-500' },
  { text: 'Session "Sprint 3" ended', time: '15m ago', color: 'bg-blue-500' },
  { text: 'New member registered: Alex', time: '1h ago', color: 'bg-amber-500' },
];

export default function Layout({ currentPage, navigate, children, userEmail }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'U';

  return (
    <div className="flex h-screen bg-[#070D1A] overflow-hidden">

      {/* ─── Sidebar ─── */}
      <aside
        className={`relative flex flex-col bg-[#0B1120] border-r border-white/5 transition-all duration-300 flex-shrink-0 ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        {/* Subtle gradient accent top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-blue-500/0 via-blue-500/60 to-blue-500/0" />

        {/* Brand */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/5 ${!sidebarOpen ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/30">
            <Activity size={17} className="text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <p className="font-black text-sm text-white tracking-tight">ContribuTrack</p>
              <p className="text-[10px] text-blue-400 font-medium">IoT + AI Platform</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-5 overflow-y-auto space-y-0.5 px-2">
          {sidebarOpen && (
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-3">Navigation</p>
          )}
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = currentPage === id;
            return (
              <button
                key={id}
                onClick={() => navigate(id)}
                title={!sidebarOpen ? label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative group ${
                  active
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-200 border border-transparent'
                } ${!sidebarOpen ? 'justify-center' : ''}`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-blue-400 to-cyan-400 rounded-r-full" />
                )}
                <Icon size={17} className={`flex-shrink-0 ${active ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                {sidebarOpen && <span className="flex-1 text-left">{label}</span>}
                {sidebarOpen && active && <ChevronRight size={13} className="text-blue-400/60" />}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/5 p-3">
          <div className={`flex items-center gap-2.5 ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-lg shadow-blue-500/20">
              {initials}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">{userEmail ?? 'Guest'}</p>
                <p className="text-[10px] text-gray-500">Administrator</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/5 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-all"
          >
            {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
          </button>

          <div>
            <h1 className="text-base font-bold text-white leading-tight">{PAGE_TITLES[currentPage]}</h1>
            {PAGE_SUBTITLES[currentPage] && (
              <p className="text-[11px] text-gray-500">{PAGE_SUBTITLES[currentPage]}</p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="pl-8 pr-4 py-2 text-xs bg-white/5 border border-white/8 text-gray-300 rounded-xl placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/30 w-44 transition-all"
                placeholder="Search…"
              />
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((p) => !p)}
                className="relative w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-all"
              >
                <Bell size={16} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-[#0B1120]" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-76 w-72 bg-[#0F1829] border border-white/8 rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-sm font-semibold text-white">Notifications</p>
                    <p className="text-xs text-gray-500">{NOTIFS.length} recent alerts</p>
                  </div>
                  <div className="p-2">
                    {NOTIFS.map((n, i) => (
                      <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-default">
                        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.color}`} />
                        <div>
                          <p className="text-xs text-gray-300 leading-relaxed">{n.text}</p>
                          <p className="text-[10px] text-gray-600 mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sign out */}
            <button
              onClick={() => navigate('landing')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-200 hover:bg-white/5 rounded-xl transition-all font-medium"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
