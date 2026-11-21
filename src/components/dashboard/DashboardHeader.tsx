import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  FilePlus2,
  GraduationCap,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { FairnessMethod } from '../../lib/settings';
import type { Session } from '../../lib/types';
import { PulseDot } from './DashboardWidgets';

export type DashboardTab = 'overview' | 'team' | 'telemetry' | 'insights';

export default function DashboardHeader({
  workspaceName,
  sessions,
  selectedSessionId,
  onSelectSession,
  live,
  onToggleLive,
  pollInterval,
  lastUpdate,
  analyzing,
  onRecalculate,
  onRefresh,
  onOpenPeer,
  onOpenEvidence,
  onOpenLms,
  onExportCsv,
  onPrint,
  disableCsv,
  activeTab,
  onTabChange,
  counts,
  fairnessMethod,
  fairnessScore,
}: {
  workspaceName?: string;
  sessions: Session[];
  selectedSessionId: string;
  onSelectSession: (id: string) => void;
  live: boolean;
  onToggleLive: () => void;
  pollInterval: number;
  lastUpdate: Date;
  analyzing: boolean;
  onRecalculate: () => void;
  onRefresh: () => void;
  onOpenPeer: () => void;
  onOpenEvidence: () => void;
  onOpenLms: () => void;
  onExportCsv: () => void;
  onPrint: () => void;
  disableCsv: boolean;
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  counts: { members: number; pendingEvidence: number; readings: number; insights: number };
  fairnessMethod: FairnessMethod;
  fairnessScore: number;
}) {
  const [openMenu, setOpenMenu] = useState<'actions' | 'export' | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        actionsRef.current &&
        !actionsRef.current.contains(target) &&
        exportRef.current &&
        !exportRef.current.contains(target)
      ) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const tabs: Array<{ id: DashboardTab; label: string; count?: number; pending?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'team', label: 'Team & Grading', count: counts.members, pending: counts.pendingEvidence },
    { id: 'telemetry', label: 'Live Telemetry', count: counts.readings },
    { id: 'insights', label: 'AI Insights', count: counts.insights },
  ];

  return (
    <div className="no-print space-y-5">
      {/* Row 1: Architectural Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            {workspaceName ? `${workspaceName}` : 'Contribution Overview'}
          </h2>
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-400 tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              {live ? <PulseDot /> : <span className="h-2 w-2 rounded-full bg-zinc-600" />}
              <span className="text-zinc-300 font-medium">{live ? 'Live' : 'Paused'}</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>Updated {lastUpdate.toLocaleTimeString()} · {pollInterval}s</span>
            <span className="text-zinc-700">·</span>
            <select
              value={selectedSessionId}
              onChange={(e) => onSelectSession(e.target.value)}
              aria-label="Filter dashboard by session"
              className="rounded-md border border-transparent bg-transparent py-0.5 pr-1 text-xs font-medium text-zinc-200 hover:border-white/[0.1] hover:bg-white/[0.04] focus:border-white/20 focus:outline-none [&>option]:bg-[#111114]"
            >
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} {s.status === 'active' ? '(Live)' : ''}
                </option>
              ))}
            </select>
            {analyzing && (
              <span className="inline-flex items-center gap-1 text-zinc-300">
                <RefreshCw size={11} className="animate-spin" />
                Scoring…
              </span>
            )}
          </div>
        </div>

        {/* Strictly 3 Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Actions Dropdown */}
          <div className="relative" ref={actionsRef}>
            <button
              type="button"
              onClick={() => setOpenMenu((m) => (m === 'actions' ? null : 'actions'))}
              aria-expanded={openMenu === 'actions'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] transition-colors whitespace-nowrap"
            >
              <SlidersHorizontal size={12} className="text-zinc-400" />
              Actions
              <ChevronDown size={12} className="text-zinc-400" />
            </button>
            {openMenu === 'actions' && (
              <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-white/[0.12] bg-[#18181B] p-1.5 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenPeer();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/[0.06]"
                >
                  <Star size={13} className="text-amber-400 flex-shrink-0" />
                  360° Peer Check-In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenEvidence();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/[0.06]"
                >
                  <FilePlus2 size={13} className="text-emerald-400 flex-shrink-0" />
                  Submit Offline Evidence
                </button>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onToggleLive();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/[0.06]"
                >
                  {live ? (
                    <WifiOff size={13} className="text-zinc-400 flex-shrink-0" />
                  ) : (
                    <Wifi size={13} className="text-emerald-400 flex-shrink-0" />
                  )}
                  {live ? 'Pause Live Polling' : 'Resume Live Polling'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onRefresh();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/[0.06]"
                >
                  <RefreshCw size={13} className="text-zinc-400 flex-shrink-0" />
                  Refresh Now
                </button>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setOpenMenu((m) => (m === 'export' ? null : 'export'))}
              aria-expanded={openMenu === 'export'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] transition-colors whitespace-nowrap"
            >
              <Download size={12} className="text-zinc-400" />
              Export
              <ChevronDown size={12} className="text-zinc-400" />
            </button>
            {openMenu === 'export' && (
              <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-white/[0.12] bg-[#18181B] p-1.5 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenLms();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/[0.06]"
                >
                  <GraduationCap size={13} className="text-indigo-400 flex-shrink-0" />
                  <span>LMS Gradebook (Canvas / Moodle)</span>
                </button>
                <button
                  type="button"
                  disabled={disableCsv}
                  onClick={() => {
                    setOpenMenu(null);
                    onExportCsv();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40"
                >
                  <Download size={13} className="text-zinc-400 flex-shrink-0" />
                  Export CSV Report
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onPrint();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/[0.06]"
                >
                  <Printer size={13} className="text-zinc-400 flex-shrink-0" />
                  Print Grading Dossier
                </button>
              </div>
            )}
          </div>

          {/* Signature Pure White Primary CTA */}
          <button
            type="button"
            onClick={onRecalculate}
            disabled={analyzing}
            className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            <Sparkles size={12} />
            {analyzing ? 'Scoring…' : 'Recalculate AI'}
          </button>
        </div>
      </div>

      {/* Row 2: Crisp Hairline Underline Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.07]">
        <nav aria-label="Dashboard sections" className="flex items-center gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`-mb-px inline-flex flex-shrink-0 items-center gap-2 border-b-2 pb-3 text-[13px] transition-colors whitespace-nowrap ${
                  active
                    ? 'border-white font-semibold text-white'
                    : 'border-transparent font-medium text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums ${
                      active ? 'bg-white/[0.1] text-white' : 'bg-white/[0.05] text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.pending !== undefined && tab.pending > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300 tabular-nums">
                    {tab.pending} pending
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-1.5 pb-3 text-xs text-zinc-500 tabular-nums whitespace-nowrap">
          <span>Fairness ({fairnessMethod.toUpperCase()})</span>
          <span>·</span>
          <span className="font-semibold text-zinc-200">{fairnessScore}/100</span>
        </div>
      </div>
    </div>
  );
}
