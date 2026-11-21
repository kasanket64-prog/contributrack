import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  Brain,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Mic,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { supabase, triggerContributionAnalysis } from '../lib/supabase';
import { computeFairnessScore, saveSettings } from '../lib/settings';
import {
  MEMBER_COLORS,
  buildContributionCsv,
  buildPeerRatingMap,
  computeCoachingNudges,
  computeMemberStats,
  getCalibration,
} from '../lib/dashboardMetrics';
import { useAppSettings, useDashboardQuery } from '../hooks/useWorkspaceQueries';
import { PulseDot, ScoreDial } from '../components/dashboard/DashboardWidgets';
import DashboardHeader, { type DashboardTab } from '../components/dashboard/DashboardHeader';
import AnalyticsCanvasCard from '../components/dashboard/AnalyticsCanvasCard';
import TeamHealthRail from '../components/dashboard/TeamHealthRail';
import PeerCalibrationModal from '../components/dashboard/PeerCalibrationModal';
import CredentialCertificateModal from '../components/dashboard/CredentialCertificateModal';
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist';
import EvidenceReviewCard from '../components/dashboard/EvidenceReviewCard';
import EvidenceSubmitModal from '../components/dashboard/EvidenceSubmitModal';
import LmsExportModal from '../components/dashboard/LmsExportModal';
import MemberSelfView from '../components/dashboard/MemberSelfView';
import LineChart from '../components/charts/LineChart';
import type { IotData, Page } from '../lib/types';

export default function Dashboard({
  navigate,
}: {
  navigate?: (page: Page, params?: { sessionId?: string; credentialId?: string }) => void;
}) {
  const qc = useQueryClient();
  const appSettings = useAppSettings();
  const workspaceId = appSettings.activeWorkspaceId;

  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [live, setLive] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [peerModalOpen, setPeerModalOpen] = useState(false);
  const [certMemberId, setCertMemberId] = useState<string | null>(null);
  const [lmsOpen, setLmsOpen] = useState(false);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [evidenceDefaultMemberId, setEvidenceDefaultMemberId] = useState<string | undefined>(undefined);

  const { data, isLoading, dataUpdatedAt, refetch } = useDashboardQuery(
    workspaceId,
    selectedSessionId,
    live,
    appSettings.pollInterval,
  );

  useEffect(() => {
    setSelectedSessionId('');
    setExpandedInsight(null);
    setCertMemberId(null);
  }, [workspaceId]);

  const analyzingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAnalysis = useCallback(async () => {
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    setAnalyzing(true);
    try {
      const ok = await triggerContributionAnalysis(selectedSessionId || undefined, workspaceId);
      if (ok) await qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] });
    } catch {
      /* silent */
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, [qc, selectedSessionId, workspaceId]);

  const scheduleAnalysis = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runAnalysis();
    }, 10_000);
  }, [runAnalysis]);

  useEffect(() => {
    void runAnalysis();
    const ch = supabase
      .channel(`db-rt-${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'iot_data' }, () => {
        void qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] });
        scheduleAnalysis();
      })
      .subscribe();
    const ai = setInterval(() => void runAnalysis(), 120_000);
    return () => {
      void supabase.removeChannel(ch);
      clearInterval(ai);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [qc, runAnalysis, scheduleAnalysis, workspaceId]);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-full min-h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-white/15 border-t-white animate-spin" />
          <p className="text-xs text-zinc-400 font-medium">Loading workspace overview…</p>
        </div>
      </div>
    );
  }

  const members = data?.members ?? [];
  const iotData = data?.iotData ?? [];
  const sessions = data?.sessions ?? [];
  const documents = data?.documents ?? [];
  const insights = data?.insights ?? [];
  const evidence = data?.evidence ?? [];
  const peerReviews = data?.peerReviews ?? [];
  const peerRatings = buildPeerRatingMap(peerReviews);

  const memberStats = computeMemberStats(members, insights, iotData, documents);
  const fairScores = memberStats.filter((m) => m.readingCount > 0).map((m) => m.contributionPct);
  const fairnessScore = computeFairnessScore(fairScores, appSettings.fairnessMethod);

  const totalReadings = iotData.length;
  const docCount = documents.length;
  const activeSessions = sessions.filter((s) => s.status === 'active').length;
  const totalActiveMinutes = memberStats.reduce((s, m) => s + m.activeMinutes, 0);
  const totalWords = documents.reduce((s, d) => s + (d.word_count ?? 0), 0);
  const avgActiveMinutes = members.length > 0 ? Math.round(totalActiveMinutes / members.length) : 0;
  const pendingEvidenceCount = evidence.filter((e) => e.status === 'pending').length;

  const recent20 = [...iotData].reverse().slice(-20);
  const voiceLineData = recent20.map((d, idx) => ({ label: String(idx + 1), value: d.voice }));
  const voiceActiveCount = recent20.filter((d) => d.voice === 1).length;

  const latestByMember: Record<string, IotData> = {};
  for (const d of iotData) if (d.member_id && !latestByMember[d.member_id]) latestByMember[d.member_id] = d;

  const coachingNudges = computeCoachingNudges(memberStats, iotData, docCount, totalReadings);
  const certMember = certMemberId ? memberStats.find((m) => m.member.id === certMemberId) ?? null : null;
  const certCalibration = certMember ? getCalibration(certMember, peerRatings) : null;

  const onboardingComplete =
    members.length >= 2 &&
    (totalReadings > 0 || docCount > 0) &&
    (peerReviews.length > 0 || evidence.length > 0);

  if (appSettings.viewMode === 'member') {
    const actingId = members.some((m) => m.id === appSettings.actingMemberId)
      ? appSettings.actingMemberId
      : members[0]?.id ?? '';
    return (
      <>
        <MemberSelfView
          workspaceName={appSettings.projectName}
          members={members}
          memberStats={memberStats}
          iotData={iotData}
          peerRatings={peerRatings}
          evidence={evidence}
          actingMemberId={actingId}
          privacyMode={appSettings.sensorPrivacyMode}
          onOpenCert={(id) => setCertMemberId(id)}
          onOpenSubmitEvidence={(id) => {
            setEvidenceDefaultMemberId(id);
            setEvidenceModalOpen(true);
          }}
          navigate={navigate ? (p) => navigate(p) : undefined}
        />
        <EvidenceSubmitModal
          open={evidenceModalOpen}
          onClose={() => setEvidenceModalOpen(false)}
          workspaceId={workspaceId}
          members={members}
          defaultMemberId={evidenceDefaultMemberId || actingId}
          lockMember
        />
        <CredentialCertificateModal
          certMember={certMember}
          calibration={certCalibration}
          workspaceId={workspaceId}
          workspaceName={appSettings.projectName}
          fairnessMethod={appSettings.fairnessMethod}
          onClose={() => setCertMemberId(null)}
          navigate={navigate}
        />
      </>
    );
  }

  const handleExportCsv = () => {
    const csv = buildContributionCsv(memberStats);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contributrack-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date();
  const containerSpacing = appSettings.compactCards ? 'p-4 space-y-4' : 'p-5 lg:p-7 space-y-6';

  const fairnessBarColor =
    fairnessScore >= 75 ? 'bg-emerald-400' : fairnessScore >= 50 ? 'bg-amber-400' : 'bg-rose-400';
  const fairnessLabel =
    fairnessScore >= 75 ? 'Balanced' : fairnessScore >= 50 ? 'Moderate' : 'Low Balance';

  return (
    <div className={`max-w-[1440px] mx-auto min-h-full ${containerSpacing}`}>
      {/* Print Header */}
      <div className="hidden print-only border-b border-gray-300 pb-4 mb-4">
        <h1 className="text-2xl font-black text-gray-900">{appSettings.projectName} — Contribution Grading Dossier</h1>
        <p className="text-xs text-gray-600 mt-1">
          Generated {new Date().toLocaleString()} · Fairness Score: {fairnessScore}/100 ({appSettings.fairnessMethod}) · {members.length} Members · {docCount} Documents
        </p>
      </div>

      {/* Unified Calm Obsidian Header */}
      <DashboardHeader
        workspaceName={appSettings.projectName}
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
        live={live}
        onToggleLive={() => setLive((p) => !p)}
        pollInterval={appSettings.pollInterval}
        lastUpdate={lastUpdate}
        analyzing={analyzing}
        onRecalculate={() => void runAnalysis()}
        onRefresh={() => void refetch()}
        onOpenPeer={() => setPeerModalOpen(true)}
        onOpenEvidence={() => {
          setEvidenceDefaultMemberId(undefined);
          setEvidenceModalOpen(true);
        }}
        onOpenLms={() => setLmsOpen(true)}
        onExportCsv={handleExportCsv}
        onPrint={() => window.print()}
        disableCsv={memberStats.length === 0}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          members: members.length,
          pendingEvidence: pendingEvidenceCount,
          readings: totalReadings,
          insights: insights.length,
        }}
        fairnessMethod={appSettings.fairnessMethod}
        fairnessScore={fairnessScore}
      />

      {/* Smart Onboarding Checklist: shown only while incomplete */}
      {!appSettings.onboardingDismissed && !onboardingComplete && (
        <OnboardingChecklist
          membersCount={members.length}
          iotCount={totalReadings}
          docCount={docCount}
          peerReviewCount={peerReviews.length}
          evidenceCount={evidence.length}
          navigate={navigate ? (p) => navigate(p) : undefined}
          onOpenPeerModal={() => setPeerModalOpen(true)}
          onDismiss={() => saveSettings({ ...appSettings, onboardingDismissed: true })}
        />
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Executive Obsidian KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Team Members */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111114] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex flex-col justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Team Members</p>
              <div className="flex items-end justify-between gap-2">
                <p className="text-3xl font-semibold tracking-tight text-white tabular-nums leading-none">
                  {members.length}
                </p>
                {members.length > 0 && (
                  <div className="flex items-center -space-x-1.5">
                    {members.slice(0, 4).map((m, idx) => (
                      <div
                        key={m.id}
                        title={m.name}
                        className="h-6 w-6 rounded-full border-2 border-[#111114] flex items-center justify-center text-[10px] font-semibold text-white"
                        style={{ backgroundColor: MEMBER_COLORS[idx % MEMBER_COLORS.length] }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {members.length > 4 && (
                      <div className="h-6 px-1.5 rounded-full border-2 border-[#111114] bg-zinc-800 flex items-center justify-center text-[10px] font-medium text-zinc-300 tabular-nums">
                        +{members.length - 4}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* KPI 2: Fairness Index */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111114] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Fairness Index</p>
                <span className="text-[11px] font-medium text-zinc-400 tabular-nums">{activeSessions} live</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-3xl font-semibold tracking-tight text-white tabular-nums leading-none">
                    {fairnessScore}
                    <span className="text-sm font-medium text-zinc-500">/100</span>
                  </p>
                  <span className="text-xs font-medium text-zinc-400">{fairnessLabel}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full ${fairnessBarColor}`} style={{ width: `${fairnessScore}%` }} />
                </div>
              </div>
            </div>

            {/* KPI 3: Active Participation */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111114] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex flex-col justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Active Participation</p>
              <div>
                <p className="text-3xl font-semibold tracking-tight text-white tabular-nums leading-none">
                  {totalActiveMinutes}m
                </p>
                <p className="mt-1.5 text-xs text-zinc-400 tabular-nums">
                  Avg {avgActiveMinutes}m / member
                </p>
              </div>
            </div>

            {/* KPI 4: Written Telemetry */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111114] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex flex-col justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Written Telemetry</p>
              <div>
                <p className="text-3xl font-semibold tracking-tight text-white tabular-nums leading-none">
                  {docCount} <span className="text-base font-medium text-zinc-400">docs</span>
                </p>
                <p className="mt-1.5 text-xs text-zinc-400 tabular-nums">
                  {totalWords.toLocaleString()} words synced
                </p>
              </div>
            </div>
          </div>

          {/* 8 / 4 Asymmetric Split: Analytics Matrix / Growth / Output + Team Health Rail */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8 flex flex-col [&>*]:flex-1">
              <AnalyticsCanvasCard
                iotData={iotData}
                members={members}
                memberStats={memberStats}
                analyzing={analyzing}
              />
            </div>
            <div className="lg:col-span-4 flex flex-col [&>*]:flex-1">
              <TeamHealthRail
                fairnessScore={fairnessScore}
                fairnessMethod={appSettings.fairnessMethod}
                memberStats={memberStats}
                coachingNudges={coachingNudges}
                pendingEvidenceCount={pendingEvidenceCount}
                onGoToInsights={() => setActiveTab('insights')}
                onGoToTeam={() => setActiveTab('team')}
              />
            </div>
          </div>

          {/* Refined 5-Column Team Snapshot */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Team Snapshot</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Contribution share, overall score, peer calibration, and signed credentials
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className="no-print inline-flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white whitespace-nowrap"
              >
                Full matrix &amp; appeals <ArrowRight size={12} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    {['Member', 'Contribution Share', 'Overall Score', 'Peer Calibration', 'Credential'].map((h) => (
                      <th
                        key={h}
                        className={`py-3 px-4 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 whitespace-nowrap ${
                          h === 'Credential' ? 'no-print' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {memberStats.map((ms) => {
                    const cal = getCalibration(ms, peerRatings);
                    return (
                      <tr key={ms.member.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                              style={{ backgroundColor: ms.color }}
                            >
                              {ms.member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-zinc-100">{ms.member.name}</p>
                              <p className="text-[11px] text-zinc-500">{ms.member.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${ms.contributionPct}%`, backgroundColor: ms.color }} />
                            </div>
                            <span className="font-semibold text-zinc-100 tabular-nums">{ms.contributionPct}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap">
                          <span className="text-sm font-semibold text-white">{ms.overallScore}</span>
                          <span className="text-zinc-500 text-[11px]">/100</span>
                        </td>
                        <td className="py-3.5 px-4">
                          {cal ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-300 tabular-nums">
                                <Star size={10} className="fill-amber-400 text-amber-400" />
                                {cal.rating}/5
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${cal.cls}`}>
                                {cal.label}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPeerModalOpen(true)}
                              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline whitespace-nowrap"
                            >
                              Rate offline work
                            </button>
                          )}
                        </td>
                        <td className="py-3.5 px-4 no-print whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setCertMemberId(ms.member.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/[0.08] transition-colors"
                          >
                            <Award size={11} className="text-zinc-400" /> Certificate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {memberStats.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-zinc-500">
                        <Activity size={20} className="mx-auto mb-2 opacity-25" />
                        <p className="text-xs">No members registered in this workspace yet.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: TEAM & GRADING */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white text-sm">Member Contribution Overview</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Full matrix across Voice · Presence · Writing · Active Time · Peer Calibration
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PulseDot />
                <span className="text-xs text-zinc-400 tabular-nums">{totalReadings} readings</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    {['Member', 'Contribution', 'Voice', 'Presence', 'Writing', 'Active Time', 'Peer Calibration', 'Score', 'Level', 'Credential'].map((h) => (
                      <th
                        key={h}
                        className={`text-left py-2.5 px-3 text-[10px] font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap ${
                          h === 'Credential' ? 'no-print' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {memberStats.map((ms) => {
                    const ec =
                      ms.engagementLevel === 'HIGH'
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                        : ms.engagementLevel === 'MEDIUM'
                        ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                        : 'text-zinc-400 bg-white/[0.04] border-white/[0.08]';
                    const cal = getCalibration(ms, peerRatings);
                    return (
                      <tr key={ms.member.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02]">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
                              style={{ backgroundColor: ms.color }}
                            >
                              {ms.member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-zinc-100">{ms.member.name}</p>
                              <p className="text-[10px] text-zinc-500">{ms.member.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${ms.contributionPct}%`, backgroundColor: ms.color }} />
                            </div>
                            <span className="font-semibold text-zinc-100 tabular-nums">{ms.contributionPct}%</span>
                          </div>
                        </td>
                        {[
                          { value: ms.voiceScore, color: '#818CF8' },
                          { value: ms.presenceScore, color: '#34D399' },
                          { value: ms.writingScore, color: '#FBBF24' },
                        ].map(({ value, color }, ci) => (
                          <td key={ci} className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
                              </div>
                              <span className="text-zinc-300 font-medium tabular-nums">{value}</span>
                            </div>
                          </td>
                        ))}
                        <td className="py-3 px-3 text-zinc-300 font-medium tabular-nums whitespace-nowrap">
                          {ms.activeMinutes > 0 ? `${ms.activeMinutes}m` : '—'}
                          {ms.sessionMinutes > 0 && <span className="text-zinc-500"> / {ms.sessionMinutes}m</span>}
                        </td>
                        <td className="py-3 px-3">
                          {cal ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-300 tabular-nums">
                                <Star size={10} className="fill-amber-400 text-amber-400" />
                                {cal.rating}/5
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium border ${cal.cls}`}>
                                {cal.label}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPeerModalOpen(true)}
                              className="text-[10px] text-zinc-400 hover:text-white underline whitespace-nowrap"
                            >
                              Rate offline work
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                          <span className="text-sm font-semibold text-white">{ms.overallScore}</span>
                          <span className="text-zinc-500 text-[10px]">/100</span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {ms.engagementLevel ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ec}`}>
                              {ms.engagementLevel}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 no-print whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setCertMemberId(ms.member.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-zinc-200 hover:bg-white/[0.08] transition-colors"
                          >
                            <Award size={11} className="text-zinc-400" /> Certificate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {memberStats.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-zinc-500">
                        <Activity size={24} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No members yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <EvidenceReviewCard
            workspaceId={workspaceId}
            evidence={evidence}
            members={members}
            onOpenSubmit={() => {
              setEvidenceDefaultMemberId(undefined);
              setEvidenceModalOpen(true);
            }}
          />
        </div>
      )}

      {/* TAB 3: LIVE TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white text-sm">Member Presence</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Live attendance &amp; latest reading status</p>
                </div>
                <Camera size={16} className="text-zinc-500" />
              </div>
              {memberStats.length > 0 ? (
                <div className="space-y-3">
                  {memberStats.map((ms) => {
                    const latest = latestByMember[ms.member.id];
                    const present = latest ? latest.face === 1 : false;
                    const voice = latest ? latest.voice === 1 : false;
                    return (
                      <div key={ms.member.id} className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                            style={{ backgroundColor: ms.color }}
                          >
                            {ms.member.name.charAt(0).toUpperCase()}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111114] ${
                              present ? 'bg-emerald-400' : 'bg-zinc-600'
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-zinc-200 truncate">{ms.member.name}</p>
                            {voice && present && <Mic size={10} className="text-indigo-400 flex-shrink-0" />}
                          </div>
                          <p className={`text-[10px] ${present ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {latest ? (present ? 'Present' : 'Absent') : 'No data'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${ms.contributionPct}%`, backgroundColor: ms.color }} />
                          </div>
                          <span className="text-[11px] font-semibold w-8 text-right tabular-nums text-zinc-200">
                            {ms.contributionPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-24 text-zinc-500">
                  <Users size={20} className="mb-2 opacity-30" />
                  <p className="text-xs">No members yet</p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white text-sm">Voice Activity Stream</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Last 20 sensor readings</p>
                </div>
                <Mic size={16} className="text-indigo-400" />
              </div>
              <LineChart data={voiceLineData} color="#818CF8" height={160} />
              <div className="flex items-center justify-between mt-3 text-xs tabular-nums">
                <span className="text-zinc-400">{totalReadings} total readings</span>
                <span className="font-medium text-indigo-300">{voiceActiveCount} active turns in window</span>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white text-sm">Live Sensor Feed</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Raw voice &amp; presence telemetry per reading</p>
              </div>
              <div className="flex items-center gap-2">
                <PulseDot />
                <span className="text-xs text-zinc-400 tabular-nums">{totalReadings} total</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    {['Time', 'Member', 'Expression', 'Voice & Quality', 'Transcript', 'Score', 'Level'].map((h) => (
                      <th key={h} className="text-left py-2.5 px-3 text-[10px] font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {iotData.slice(0, 12).map((d, idx) => {
                    const mi = members.findIndex((m) => m.id === d.member_id);
                    const color = mi >= 0 ? MEMBER_COLORS[mi % MEMBER_COLORS.length] : '#6B7280';
                    const lc =
                      d.contribution_level === 'HIGH'
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                        : d.contribution_level === 'MEDIUM'
                        ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                        : 'text-zinc-400 bg-white/[0.04] border-white/[0.08]';
                    const expr = d.face_expression ?? (d.face ? 'NEUTRAL' : 'ABSENT');
                    const exprCls =
                      expr === 'ENGAGED'
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                        : expr === 'FOCUSED'
                        ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20'
                        : expr === 'DISTRACTED'
                        ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                        : expr === 'DROWSY'
                        ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
                        : 'text-zinc-300 bg-white/[0.04] border-white/[0.08]';
                    return (
                      <tr key={d.id} className={`border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] ${idx === 0 ? 'bg-white/[0.02]' : ''}`}>
                        <td className="py-3 px-3 text-zinc-400 font-mono text-[11px] tabular-nums whitespace-nowrap">
                          {new Date(d.created_at).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {d.members?.name ? d.members.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span className="text-zinc-200 font-medium">{d.members?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${exprCls}`}>
                            {expr}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${d.voice ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' : 'text-zinc-400 bg-white/[0.04] border-white/[0.08]'}`}>
                              <Mic size={9} />
                              {d.voice ? 'Active' : 'Silent'}
                            </span>
                            {d.voice_quality && d.voice === 1 && (
                              <span className="text-[10px] font-mono text-zinc-300 bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded">
                                {d.voice_quality}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-[240px]">
                          {d.transcript ? (
                            <span className="text-zinc-300 italic truncate block" title={d.transcript}>
                              &ldquo;{d.transcript}&rdquo;
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-zinc-200 tabular-nums whitespace-nowrap">
                          {d.engagement_score ?? d.contribution_pct}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${lc}`}>{d.contribution_level}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {iotData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        <Activity size={24} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No sensor data yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: AI INSIGHTS */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {coachingNudges.length > 0 && (
            <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] space-y-3">
              <div className="flex items-center gap-2.5">
                <Lightbulb size={15} className="text-amber-400" />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white">AI Team Coach &amp; Live Nudges</h3>
                  <p className="text-xs text-zinc-400">Recommended facilitation actions to balance team participation</p>
                </div>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {coachingNudges.map((n) => {
                  const dotCls = n.tone === 'rose' ? 'bg-rose-400' : n.tone === 'amber' ? 'bg-amber-400' : 'bg-indigo-400';
                  return (
                    <div key={n.id} className="flex items-start gap-2.5 py-2.5 first:pt-1 last:pb-0 text-xs leading-relaxed text-zinc-300">
                      <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
                      <span>{n.text}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] flex items-center justify-center">
                <Brain size={16} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Contribution Deep-Dives</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Voice · Presence · Writing · Active Time — narrative breakdown per member</p>
              </div>
            </div>

            {insights.length > 0 ? (
              <div className="space-y-2.5">
                {insights.map((ins, i) => {
                  const ms = memberStats.find((m) => m.member.id === ins.member_id);
                  const color = ms?.color ?? '#6B7280';
                  const name = ms?.member.name ?? 'Unknown';
                  const isOpen = expandedInsight === ins.member_id;
                  const ec =
                    ins.engagement_level === 'HIGH'
                      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                      : ins.engagement_level === 'MEDIUM'
                      ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                      : 'text-rose-300 bg-rose-500/10 border-rose-500/20';
                  return (
                    <div key={ins.member_id} className="border border-white/[0.07] rounded-xl overflow-hidden bg-white/[0.015] hover:border-white/[0.13] transition-colors">
                      <button
                        type="button"
                        onClick={() => setExpandedInsight(isOpen ? null : ins.member_id)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors text-left"
                      >
                        <span className="text-xs font-semibold text-zinc-500 w-5 flex-shrink-0 tabular-nums">#{i + 1}</span>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-zinc-100 text-sm">{name}</p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ec}`}>{ins.engagement_level}</span>
                          </div>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">{ins.narrative.slice(0, 100)}…</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 tabular-nums">
                          <div className="text-right">
                            <p className="text-lg font-semibold text-white">{ins.overall_score}</p>
                            <p className="text-[10px] text-zinc-500 -mt-0.5">/ 100</p>
                          </div>
                          {isOpen ? <ChevronUp size={15} className="text-zinc-400" /> : <ChevronDown size={15} className="text-zinc-400" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-5 border-t border-white/[0.06] bg-black/20">
                          <div className="mt-4 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-sm text-zinc-300 leading-relaxed">
                            {ins.narrative}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                            <ScoreDial value={ins.voice_score} color="#818CF8" label="Voice" sub={`${ins.reading_count} readings`} />
                            <ScoreDial value={ins.presence_score} color="#34D399" label="Presence" sub="Face detection" />
                            <ScoreDial value={ins.writing_score} color="#FBBF24" label="Writing" sub={`${ins.word_count.toLocaleString()} words`} />
                            <ScoreDial value={ins.consistency_score} color="#38BDF8" label="Consistency" sub="Stability" />
                            <ScoreDial
                              value={Math.round(ins.session_duration_minutes > 0 ? (ins.active_time_minutes / ins.session_duration_minutes) * 100 : 0)}
                              color="#F472B6"
                              label="Active %"
                              sub={`${ins.active_time_minutes}m / ${ins.session_duration_minutes}m`}
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl p-4">
                              <p className="text-xs font-semibold text-emerald-300 mb-2 flex items-center gap-1.5">
                                <CheckCircle size={12} /> Strengths
                              </p>
                              <ul className="space-y-1.5">
                                {(ins.strengths as string[]).map((s, j) => (
                                  <li key={j} className="text-xs text-zinc-300 flex items-start gap-1.5">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl p-4">
                              <p className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
                                <AlertTriangle size={12} /> To Improve
                              </p>
                              <ul className="space-y-1.5">
                                {(ins.improvements as string[]).map((s, j) => (
                                  <li key={j} className="text-xs text-zinc-300 flex items-start gap-1.5">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setCertMemberId(ins.member_id)}
                              className="no-print inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-white/[0.08] transition-colors"
                            >
                              <ShieldCheck size={13} className="text-zinc-400" /> View Contribution Certificate
                            </button>
                            <p className="text-[10px] text-zinc-500">Last scored: {new Date(ins.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-zinc-500">
                <Brain size={32} className="mb-3 opacity-20" />
                <p className="text-sm font-medium text-zinc-400">No data to score yet</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Shared Modals */}
      <PeerCalibrationModal
        open={peerModalOpen}
        onClose={() => setPeerModalOpen(false)}
        workspaceId={workspaceId}
        memberStats={memberStats}
        initialRatings={peerRatings}
      />

      <CredentialCertificateModal
        certMember={certMember}
        calibration={certCalibration}
        workspaceId={workspaceId}
        workspaceName={appSettings.projectName}
        fairnessMethod={appSettings.fairnessMethod}
        onClose={() => setCertMemberId(null)}
        navigate={navigate}
      />

      <EvidenceSubmitModal
        open={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
        workspaceId={workspaceId}
        members={members}
        defaultMemberId={evidenceDefaultMemberId}
      />

      <LmsExportModal
        open={lmsOpen}
        onClose={() => setLmsOpen(false)}
        workspaceName={appSettings.projectName}
        memberStats={memberStats}
        peerRatings={peerRatings}
        evidence={evidence}
      />
    </div>
  );
}
