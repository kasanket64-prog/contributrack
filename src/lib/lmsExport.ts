import { escapeCsvCell, type MemberStat, type PeerRatingEntry } from './dashboardMetrics';

export type LmsPlatform = 'canvas' | 'moodle' | 'google_classroom';

export interface RubricWeights {
  telemetryWeight: number;
  peerWeight: number;
  evidenceBonusMax: number;
  maxPoints: number;
}

export interface GradedMemberRow {
  memberId: string;
  name: string;
  email: string;
  role: string;
  rawScore: number;
  peerScore: number;
  approvedEvidenceCount: number;
  evidenceBonus: number;
  finalPct: number;
  pointsEarned: number;
  maxPoints: number;
  letterGrade: string;
  rationale: string;
}

export function scoreToLetterGrade(pct: number): string {
  const n = Math.max(0, Math.min(100, Math.round(pct)));
  if (n >= 93) return 'A';
  if (n >= 90) return 'A-';
  if (n >= 87) return 'B+';
  if (n >= 83) return 'B';
  if (n >= 80) return 'B-';
  if (n >= 77) return 'C+';
  if (n >= 73) return 'C';
  if (n >= 70) return 'C-';
  if (n >= 60) return 'D';
  return 'F';
}

export function computeRubricGrades(
  stats: MemberStat[],
  peerRatings: Record<string, PeerRatingEntry>,
  approvedEvidenceByMember: Record<string, number>,
  weights: RubricWeights,
): GradedMemberRow[] {
  const totalBase = Math.max(1, weights.telemetryWeight + weights.peerWeight);

  return stats.map((ms) => {
    const rawScore = Math.max(0, Math.min(100, Math.round(ms.overallScore)));
    const peerEntry = peerRatings[ms.member.id];
    const peerScore = peerEntry?.rating ? Math.round(peerEntry.rating * 20) : rawScore;
    const approvedEvidenceCount = Math.max(0, approvedEvidenceByMember[ms.member.id] ?? 0);
    const evidenceBonus = Math.min(
      Math.max(0, weights.evidenceBonusMax),
      Math.round(approvedEvidenceCount * 7.5 * 10) / 10,
    );

    const weightedBase =
      (rawScore * weights.telemetryWeight + peerScore * weights.peerWeight) / totalBase;
    const finalPct = Math.max(0, Math.min(100, Math.round(weightedBase + evidenceBonus)));
    const maxPoints = Math.max(1, weights.maxPoints);
    const pointsEarned = Math.round((finalPct / 100) * maxPoints * 100) / 100;
    const letterGrade = scoreToLetterGrade(finalPct);

    const rationale = [
      `Telemetry/Writing ${rawScore}/100 (${weights.telemetryWeight}%)`,
      peerEntry?.rating ? `Peer ${peerEntry.rating}/5 (${weights.peerWeight}%)` : `Peer unrated (fallback ${rawScore})`,
      approvedEvidenceCount > 0 ? `+${evidenceBonus}pt from ${approvedEvidenceCount} approved evidence` : null,
      `${ms.contributionPct}% team share`,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      memberId: ms.member.id,
      name: ms.member.name,
      email: ms.member.email,
      role: ms.member.role,
      rawScore,
      peerScore,
      approvedEvidenceCount,
      evidenceBonus,
      finalPct,
      pointsEarned,
      maxPoints,
      letterGrade,
      rationale,
    };
  });
}

export function buildLmsCsv(
  rows: GradedMemberRow[],
  platform: LmsPlatform,
  workspaceName: string,
): string {
  if (platform === 'canvas') {
    const headers = [
      'Student',
      'ID',
      'SIS Login ID',
      'Section',
      'ContribuTrack Rubric Score',
      'Letter Grade',
    ];
    const body = rows.map((r) => [
      r.name,
      r.memberId,
      r.email,
      workspaceName,
      r.pointsEarned,
      r.letterGrade,
    ]);
    return [headers.map(escapeCsvCell).join(','), ...body.map((b) => b.map(escapeCsvCell).join(','))].join('\n');
  }

  if (platform === 'moodle') {
    const headers = [
      'First name',
      'Last name',
      'Email address',
      'ContribuTrack Score (Real)',
      'Feedback comments',
    ];
    const body = rows.map((r) => {
      const parts = r.name.trim().split(/\s+/);
      const first = parts[0] ?? r.name;
      const last = parts.slice(1).join(' ');
      return [first, last, r.email, r.pointsEarned, `${r.letterGrade} — ${r.rationale}`];
    });
    return [headers.map(escapeCsvCell).join(','), ...body.map((b) => b.map(escapeCsvCell).join(','))].join('\n');
  }

  const headers = [
    'Student Name',
    'Email',
    'Max Points',
    'Points Earned',
    'Letter Grade',
    'Rationale',
  ];
  const body = rows.map((r) => [
    r.name,
    r.email,
    r.maxPoints,
    r.pointsEarned,
    r.letterGrade,
    r.rationale,
  ]);
  return [headers.map(escapeCsvCell).join(','), ...body.map((b) => b.map(escapeCsvCell).join(','))].join('\n');
}
