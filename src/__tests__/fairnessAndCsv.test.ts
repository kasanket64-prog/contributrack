import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { computeFairnessScore } from '../lib/settings';
import { buildContributionCsv, escapeCsvCell, type MemberStat } from '../lib/dashboardMetrics';
import { analyzeText, extractXlsxText } from '../lib/documentParser';

describe('fairness calculations & CSV export', () => {
  it('computes stddev, gini, and range fairness accurately', () => {
    expect(computeFairnessScore([50, 50, 50], 'stddev')).toBe(100);
    expect(computeFairnessScore([50, 50, 50], 'gini')).toBe(100);
    expect(computeFairnessScore([50, 50, 50], 'range')).toBe(100);

    expect(computeFairnessScore([90, 10], 'range')).toBe(20);
    expect(computeFairnessScore([90, 10], 'gini')).toBeLessThan(70);
    expect(computeFairnessScore([90, 10], 'stddev')).toBeLessThan(75);
  });

  it('escapes quotes, commas, and newlines in CSV output cleanly', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"\nnext')).toBe('"say ""hi""\nnext"');

    const mockStat: MemberStat = {
      member: {
        id: 'm1',
        name: 'Priya, "Lead"',
        email: 'priya@example.com',
        role: 'leader',
        avatar_color: '#10B981',
        created_at: '2026-11-21T00:00:00Z',
      },
      color: '#10B981',
      insight: null,
      overallScore: 92,
      contributionPct: 45,
      engagementLevel: 'HIGH',
      voiceScore: 84,
      presenceScore: 98,
      writingScore: 95,
      consistencyScore: 90,
      activeMinutes: 42,
      sessionMinutes: 60,
      readingCount: 25,
      wordCount: 2100,
      docCount: 2,
    };
    const csv = buildContributionCsv([mockStat]);
    expect(csv.split('\n')[0]).toContain('Name,Role,Overall Score');
    expect(csv).toContain('"Priya, ""Lead""",leader,92,HIGH,45');
  });
});

describe('document parser & pure-JSZip .xlsx extractor', () => {
  it('analyzes text statistics cleanly', () => {
    const res = analyzeText('Hello world! This is a concise architecture test.');
    expect(res.wordCount).toBe(8);
    expect(res.sentences).toBe(2);
    expect(res.vocabularyRichness).toBe(100);
  });

  it('extracts sharedStrings and inline numbers from an .xlsx archive without vulnerable dependencies', async () => {
    const zip = new JSZip();
    zip.file(
      'xl/sharedStrings.xml',
      '<?xml version="1.0"?><sst><si><t>Member &amp; Role</t></si><si><t>Aarav</t></si><si><t>Score</t></si></sst>',
    );
    zip.file(
      'xl/workbook.xml',
      '<?xml version="1.0"?><workbook><sheets><sheet name="GradingSheet" sheetId="1" r:id="rId1"/></sheets></workbook>',
    );
    zip.file(
      'xl/worksheets/sheet1.xml',
      '<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>96</v></c></row></sheetData></worksheet>',
    );

    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const extracted = await extractXlsxText(bytes);
    expect(extracted).toContain('--- Sheet: GradingSheet ---');
    expect(extracted).toContain('Member & Role, Score');
    expect(extracted).toContain('Aarav, 96');
  });
});
