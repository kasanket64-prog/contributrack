import { describe, expect, it } from 'vitest';
import {
  activeTimeMinutes,
  buildIotRow,
  clampScore,
  computeContributionLevel,
  computeEngagementScore,
  heuristicVoiceAnalysis,
  memberSessionMinutes,
  ruleBasedAnalysis,
} from '../../supabase/functions/_shared/scoring';

describe('scoring engine', () => {
  it('clamps numeric and string scores between 0 and 100', () => {
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(142.6)).toBe(100);
    expect(clampScore('84.4')).toBe(84);
    expect(clampScore('invalid')).toBe(0);
  });

  it('computes engagement score with voice boost and absent gate', () => {
    expect(computeEngagementScore(1, 0, 'ENGAGED', 90)).toBe(0);
    expect(computeEngagementScore(1, 1, 'ABSENT', 90)).toBe(0);
    expect(computeEngagementScore(1, 1, 'ENGAGED', 80)).toBe(100);
    expect(computeEngagementScore(0, 1, 'DROWSY', null)).toBe(8);
    expect(computeEngagementScore(0, 1, 'FOCUSED', null)).toBe(65);
  });

  it('maps engagement scores to contribution levels', () => {
    expect(computeContributionLevel(80)).toEqual({ level: 'HIGH', pct: 80 });
    expect(computeContributionLevel(55)).toEqual({ level: 'MEDIUM', pct: 55 });
    expect(computeContributionLevel(2)).toEqual({ level: 'LOW', pct: 5 });
  });

  it('classifies productive, off-topic, and disruptive transcripts heuristically', () => {
    const prod = heuristicVoiceAnalysis('Let us implement the data pipeline and test the report analysis.', 'ENGAGED');
    expect(prod.voice_quality).toBe('PRODUCTIVE');
    expect(prod.voice_quality_score).toBeGreaterThanOrEqual(70);

    const offTopic = heuristicVoiceAnalysis('Did anyone watch the cricket match or netflix movie last weekend?', 'DISTRACTED');
    expect(offTopic.voice_quality).toBe('OFF_TOPIC');

    const disruptive = heuristicVoiceAnalysis('This is stupid shut up whatever', 'NEUTRAL');
    expect(disruptive.voice_quality).toBe('DISRUPTIVE');
    expect(disruptive.voice_quality_score).toBeLessThan(20);
  });

  it('builds consistent iot rows and member rule-based contribution insights', () => {
    const row = buildIotRow(
      { device_id: 'device_1', voice: 1, face: 1, face_expression: 'ENGAGED', transcript: 'Let us design the dashboard API' },
      null,
    );
    expect(row.faceExpr).toBe('ENGAGED');
    expect(row.row.contribution_level).toBe('HIGH');

    const now = Date.now();
    const sessions = [
      { id: 's1', started_at: new Date(now - 30 * 60_000).toISOString(), ended_at: null, status: 'active' },
    ];
    const readings = [
      { voice: 1, face: 1, engagement_score: 90, contribution_pct: 90, face_expression: 'ENGAGED', voice_quality: 'PRODUCTIVE', voice_quality_score: 85, is_actively_engaged: true, passive_presence: false, contribution_level: 'HIGH', transcript: 'Let us build it', session_id: 's1', created_at: new Date(now - 5 * 60_000).toISOString() },
      { voice: 1, face: 1, engagement_score: 88, contribution_pct: 88, face_expression: 'FOCUSED', voice_quality: 'PRODUCTIVE', voice_quality_score: 82, is_actively_engaged: true, passive_presence: false, contribution_level: 'HIGH', transcript: 'Testing now', session_id: 's1', created_at: new Date(now - 2 * 60_000).toISOString() },
    ];
    expect(memberSessionMinutes(readings, sessions)).toBeGreaterThanOrEqual(29);
    expect(activeTimeMinutes(readings)).toBe(1);

    const analysis = ruleBasedAnalysis(
      { id: 'm1', name: 'Aarav', role: 'leader', readings, docs: [{ word_count: 1500 }] },
      [{ id: 'm1', name: 'Aarav', role: 'leader', readings, docs: [{ word_count: 1500 }] }],
    );
    expect(analysis.overall_score).toBeGreaterThanOrEqual(75);
    expect(analysis.contribution_pct).toBe(100);
    expect(analysis.engagement_level).toBe('HIGH');
  });
});
