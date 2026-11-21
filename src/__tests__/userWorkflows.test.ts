import { describe, expect, it } from 'vitest';
import { buildLmsCsv, computeRubricGrades, scoreToLetterGrade } from '../lib/lmsExport';
import { buildCertificateSvg, buildLinkedInCertUrl } from '../lib/certificateExport';
import { computeGrowthTrends, type MemberStat } from '../lib/dashboardMetrics';
import type { IotData } from '../lib/types';

function makeStat(id: string, name: string, email: string, overallScore: number, contributionPct: number): MemberStat {
  return {
    member: {
      id,
      name,
      email,
      role: 'member',
      avatar_color: '#3B82F6',
      created_at: '2026-11-20T00:00:00Z',
    },
    color: '#3B82F6',
    insight: null,
    overallScore,
    contributionPct,
    engagementLevel: overallScore >= 75 ? 'HIGH' : 'MEDIUM',
    voiceScore: 80,
    presenceScore: 85,
    writingScore: 78,
    consistencyScore: 82,
    activeMinutes: 35,
    sessionMinutes: 45,
    readingCount: 15,
    wordCount: 1200,
    docCount: 2,
  };
}

describe('LMS rubric grading & multi-platform export', () => {
  it('maps percentage bands to standard letter grades', () => {
    expect(scoreToLetterGrade(95)).toBe('A');
    expect(scoreToLetterGrade(90)).toBe('A-');
    expect(scoreToLetterGrade(84)).toBe('B');
    expect(scoreToLetterGrade(75)).toBe('C');
    expect(scoreToLetterGrade(55)).toBe('F');
  });

  it('weights telemetry, peer ratings, and clamps approved evidence bonuses across Canvas, Moodle, and Google Classroom CSVs', () => {
    const stats = [
      makeStat('m1', 'Sneha, "Builder" Iyer', 'sneha@example.com', 60, 20),
      makeStat('m2', 'Priya Patel', 'priya@example.com', 92, 40),
    ];
    const peerRatings = {
      m1: { rating: 5, note: 'Carried hardware wiring' },
    };
    const approvedCounts = {
      m1: 3, // 3 * 7.5 = 22.5 -> clamped to evidenceBonusMax=15
      m2: 1, // 1 * 7.5 = 7.5
    };

    const rows = computeRubricGrades(stats, peerRatings, approvedCounts, {
      telemetryWeight: 70,
      peerWeight: 30,
      evidenceBonusMax: 15,
      maxPoints: 100,
    });

    // Sneha: 0.7*60 + 0.3*100 = 42 + 30 = 72 + 15 = 87 -> B+
    expect(rows[0].evidenceBonus).toBe(15);
    expect(rows[0].finalPct).toBe(87);
    expect(rows[0].letterGrade).toBe('B+');

    // Priya: no peer rating -> fallback 92 -> 92 + 7.5 = 99.5 -> rounded 100 -> A
    expect(rows[1].finalPct).toBe(100);
    expect(rows[1].letterGrade).toBe('A');

    const canvas = buildLmsCsv(rows, 'canvas', 'Capstone Cohort A');
    expect(canvas.split('\n')[0]).toBe('Student,ID,SIS Login ID,Section,ContribuTrack Rubric Score,Letter Grade');
    expect(canvas).toContain('"Sneha, ""Builder"" Iyer",m1,sneha@example.com,Capstone Cohort A,87,B+');

    const moodle = buildLmsCsv(rows, 'moodle', 'Capstone Cohort A');
    expect(moodle.split('\n')[0]).toBe('First name,Last name,Email address,ContribuTrack Score (Real),Feedback comments');
    expect(moodle).toContain('Priya,Patel,priya@example.com,100');

    const classroom = buildLmsCsv(rows, 'google_classroom', 'Capstone Cohort A');
    expect(classroom.split('\n')[0]).toBe('Student Name,Email,Max Points,Points Earned,Letter Grade,Rationale');
  });
});

describe('LinkedIn credential URL & SVG certificate generator', () => {
  it('constructs valid LinkedIn Add-to-Profile URL parameters', () => {
    const url = buildLinkedInCertUrl({
      credentialId: 'CT-2026-AABB1122',
      memberName: 'Priya Patel',
      workspaceName: 'Capstone Cohort A',
      issuedAt: '2026-11-22T01:00:00Z',
      verifyUrl: 'https://contributrack.app/verify/CT-2026-AABB1122',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://www.linkedin.com/profile/add');
    expect(parsed.searchParams.get('startTask')).toBe('CERTIFICATION_NAME');
    expect(parsed.searchParams.get('certId')).toBe('CT-2026-AABB1122');
    expect(parsed.searchParams.get('issueYear')).toBe('2026');
    expect(parsed.searchParams.get('issueMonth')).toBe('11');
    expect(parsed.searchParams.get('certUrl')).toBe('https://contributrack.app/verify/CT-2026-AABB1122');
  });

  it('escapes XML characters and embeds credential ID inside downloadable SVG markup', () => {
    const svg = buildCertificateSvg({
      credentialId: 'CT-2026-SAFE1234',
      signature: 'abcdef0123456789',
      algorithm: 'HMAC-SHA256',
      memberName: 'Aarav <Sharma> & Co',
      memberRole: 'leader',
      workspaceName: 'Capstone & Lab',
      overallScore: 91,
      contributionPct: 35,
      voiceScore: 88,
      presenceScore: 92,
      writingScore: 90,
      consistencyScore: 94,
      issuedAt: '2026-11-22T00:00:00Z',
    });
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('CT-2026-SAFE1234');
    expect(svg).toContain('Aarav &lt;Sharma&gt; &amp; Co');
    expect(svg).toContain('Capstone &amp; Lab');
  });
});

describe('sprint growth trajectory computations', () => {
  it('calculates chronological progression delta and supports per-member filtering', () => {
    const mk = (memberId: string, pct: number, minsAgo: number): IotData => ({
      id: `${memberId}-${minsAgo}`,
      device_id: 'dev_1',
      member_id: memberId,
      voice: 1,
      face: 1,
      contribution_level: pct >= 70 ? 'HIGH' : 'LOW',
      contribution_pct: pct,
      engagement_score: pct,
      created_at: new Date(Date.UTC(2026, 10, 22, 12, 0) - minsAgo * 60_000).toISOString(),
    });

    const rows: IotData[] = [
      mk('m1', 40, 120),
      mk('m1', 50, 90),
      mk('m1', 75, 60),
      mk('m1', 90, 30),
      mk('m2', 20, 45),
      mk('m2', 20, 15),
    ];

    const m1Trend = computeGrowthTrends(rows, 'm1');
    expect(m1Trend.points).toHaveLength(4);
    expect(m1Trend.earliest).toBe(40);
    expect(m1Trend.latest).toBe(90);
    expect(m1Trend.delta).toBe(50);

    const teamTrend = computeGrowthTrends(rows);
    expect(teamTrend.points.length).toBeGreaterThanOrEqual(2);
  });
});
