import type { AiInsight, Document, IotData, Member, PeerReview } from './types';

export const MEMBER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#F97316', '#EC4899'];

export interface PeerRatingEntry {
  rating: number;
  note: string;
}

export interface MemberStat {
  member: Member;
  color: string;
  insight: AiInsight | null;
  overallScore: number;
  contributionPct: number;
  engagementLevel: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  voiceScore: number;
  presenceScore: number;
  writingScore: number;
  consistencyScore: number;
  activeMinutes: number;
  sessionMinutes: number;
  readingCount: number;
  wordCount: number;
  docCount: number;
}

export interface CoachingNudge {
  id: string;
  text: string;
  tone: 'amber' | 'rose' | 'cyan';
}

export interface CalibrationBadge {
  label: string;
  cls: string;
  rating: number;
}

export function deriveLabel(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function formatDuration(start: string, end?: string | null): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diff = Math.max(0, Math.floor((e - s) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const sec = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function escapeCsvCell(v: string | number | null | undefined): string {
  const str = String(v ?? '');
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildContributionCsv(stats: MemberStat[]): string {
  const headers = [
    'Name', 'Role', 'Overall Score', 'Engagement Level', 'Contribution %',
    'Voice Score', 'Presence Score', 'Writing Score', 'Consistency Score',
    'Active Minutes', 'Session Minutes', 'Readings', 'Documents', 'Words', 'AI Narrative',
  ];
  const rows = stats.map((ms) => [
    ms.member.name,
    ms.member.role,
    ms.overallScore,
    ms.engagementLevel ?? 'N/A',
    ms.contributionPct,
    ms.voiceScore,
    ms.presenceScore,
    ms.writingScore,
    ms.consistencyScore,
    ms.activeMinutes,
    ms.sessionMinutes,
    ms.readingCount,
    ms.docCount,
    ms.wordCount,
    ms.insight?.narrative ?? '',
  ]);
  return [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\n');
}

export function computeMemberStats(
  members: Member[],
  insights: AiInsight[],
  iotData: IotData[],
  documents: Array<Pick<Document, 'id' | 'word_count' | 'member_id'>>,
): MemberStat[] {
  const insightMap = Object.fromEntries(insights.map((ins) => [ins.member_id, ins]));
  return members.map((m, i) => {
    const ins = insightMap[m.id];
    const reads = iotData.filter((d) => d.member_id === m.id);
    const iotAvg = reads.length ? Math.round(reads.reduce((s, d) => s + d.contribution_pct, 0) / reads.length) : 0;
    const memberDocs = documents.filter((d) => d.member_id === m.id);
    return {
      member: m,
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
      insight: ins ?? null,
      overallScore: ins?.overall_score ?? 0,
      contributionPct: ins?.contribution_pct ?? iotAvg,
      engagementLevel: ins?.engagement_level ?? null,
      voiceScore: ins?.voice_score ?? 0,
      presenceScore: ins?.presence_score ?? 0,
      writingScore: ins?.writing_score ?? 0,
      consistencyScore: ins?.consistency_score ?? 0,
      activeMinutes: ins?.active_time_minutes ?? 0,
      sessionMinutes: ins?.session_duration_minutes ?? 0,
      readingCount: ins?.reading_count ?? reads.length,
      wordCount: ins?.word_count ?? memberDocs.reduce((s, d) => s + (d.word_count ?? 0), 0),
      docCount: ins?.doc_count ?? memberDocs.length,
    };
  });
}

export function buildPeerRatingMap(reviews: PeerReview[]): Record<string, PeerRatingEntry> {
  const map: Record<string, PeerRatingEntry> = {};
  for (const r of reviews) {
    map[r.member_id] = { rating: r.rating, note: r.note ?? '' };
  }
  return map;
}

export function getCalibration(
  ms: Pick<MemberStat, 'overallScore' | 'member'>,
  peerRatings: Record<string, PeerRatingEntry>,
): CalibrationBadge | null {
  const entry = peerRatings[ms.member.id];
  if (!entry || !entry.rating) return null;
  const peerPct = entry.rating * 20;
  if (peerPct - ms.overallScore >= 20) {
    return { label: 'Quiet Builder — High Peer Credit', cls: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25', rating: entry.rating };
  }
  if (ms.overallScore - peerPct >= 25) {
    return { label: 'Telemetry > Peer Credit', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25', rating: entry.rating };
  }
  return { label: 'Aligned', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25', rating: entry.rating };
}

export function computeCoachingNudges(
  memberStats: MemberStat[],
  iotData: IotData[],
  docCount: number,
  totalReadings: number,
): CoachingNudge[] {
  const nudges: CoachingNudge[] = [];
  for (const ms of memberStats) {
    const recentMemberReads = iotData.filter((r) => r.member_id === ms.member.id).slice(0, 3);
    if (recentMemberReads.some((r) => r.face_expression === 'DROWSY')) {
      nudges.push({
        id: `drowsy-${ms.member.id}`,
        text: `Check in with ${ms.member.name} — recent camera telemetry detected drowsiness.`,
        tone: 'rose',
      });
    }
    if (totalReadings >= 4 && ms.contributionPct < 15) {
      nudges.push({
        id: `low-${ms.member.id}`,
        text: `Invite ${ms.member.name} to share their perspective on the current milestone (currently at ${ms.contributionPct}% share).`,
        tone: 'amber',
      });
    }
    if (docCount > 0 && ms.docCount === 0) {
      nudges.push({
        id: `doc-${ms.member.id}`,
        text: `${ms.member.name} has no linked documents yet — assign their draft or import GitHub commits on the Documents page.`,
        tone: 'cyan',
      });
    }
  }
  return nudges;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface GrowthTrendSeries {
  points: TrendPoint[];
  delta: number;
  latest: number;
  earliest: number;
}

/**
 * Computes chronological sprint/checkpoint growth windows from IoT telemetry so
 * quiet contributors and instructors can track week-over-week progression.
 */
export function computeGrowthTrends(iotData: IotData[], memberId?: string): GrowthTrendSeries {
  const filtered = (memberId ? iotData.filter((d) => d.member_id === memberId) : iotData)
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (filtered.length === 0) {
    return { points: [], delta: 0, latest: 0, earliest: 0 };
  }

  const bucketCount = Math.min(6, Math.max(2, Math.min(4, filtered.length)));
  if (filtered.length < 2) {
    const val = Math.round(filtered[0].engagement_score ?? filtered[0].contribution_pct ?? 0);
    return {
      points: [{ label: 'Checkpoint 1', value: val }],
      delta: 0,
      latest: val,
      earliest: val,
    };
  }

  const points: TrendPoint[] = [];
  const labelPrefix = bucketCount <= 4 ? 'Sprint' : 'Checkpoint';

  for (let i = 0; i < bucketCount; i++) {
    const start = Math.floor((i * filtered.length) / bucketCount);
    const end = i === bucketCount - 1 ? filtered.length : Math.floor(((i + 1) * filtered.length) / bucketCount);
    const slice = filtered.slice(start, Math.max(start + 1, end));
    const avg = Math.round(
      slice.reduce((sum, r) => sum + (r.engagement_score ?? r.contribution_pct ?? 0), 0) / slice.length,
    );
    points.push({ label: `${labelPrefix} ${i + 1}`, value: avg });
  }

  const earliest = points[0]?.value ?? 0;
  const latest = points[points.length - 1]?.value ?? earliest;
  return {
    points,
    delta: latest - earliest,
    latest,
    earliest,
  };
}
